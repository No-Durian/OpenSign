import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';

import { getEnterpriseConfig } from './enterpriseConfig.js';

const execFileAsync = promisify(execFile);
const PYTHON_SCRIPT = `
import json
import os
import sqlite3
import sys

DB_PATH = sys.argv[1]
MODE = sys.argv[2]
PAYLOAD = json.loads(sys.argv[3]) if len(sys.argv) > 3 else None

os.makedirs(os.path.dirname(DB_PATH) or '.', exist_ok=True)
connection = sqlite3.connect(DB_PATH)
connection.execute("""
CREATE TABLE IF NOT EXISTS policy_messages (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  department TEXT DEFAULT '',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
)
""")
connection.execute("""
CREATE INDEX IF NOT EXISTS idx_policy_messages_created_at
ON policy_messages(created_at DESC)
""")

if MODE == 'list':
  rows = connection.execute(
    """
    SELECT id, author, department, content, created_at AS createdAt
    FROM policy_messages
    ORDER BY datetime(created_at) DESC, rowid DESC
    """
  ).fetchall()
  print(json.dumps([
    {
      'id': row[0],
      'author': row[1],
      'department': row[2],
      'content': row[3],
      'createdAt': row[4],
    }
    for row in rows
  ], ensure_ascii=False))
elif MODE == 'insert':
  connection.execute(
    """
    INSERT INTO policy_messages (id, author, department, content, created_at)
    VALUES (?, ?, ?, ?, ?)
    """,
    (
      PAYLOAD['id'],
      PAYLOAD['author'],
      PAYLOAD['department'],
      PAYLOAD['content'],
      PAYLOAD['createdAt'],
    ),
  )
  connection.commit()
  print(json.dumps(PAYLOAD, ensure_ascii=False))
else:
  raise SystemExit(f'Unsupported mode: {MODE}')

connection.close()
`;

const PYTHON_CANDIDATES = [
  process.env.PYTHON ? [process.env.PYTHON] : null,
  ['python3'],
  ['python'],
  process.platform === 'win32' ? ['py', '-3'] : null,
].filter(Boolean);

let cachedPythonCommand = null;

function ensureDatabaseDirectory(dbPath) {
  const directory = path.dirname(dbPath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function getPythonCommand() {
  if (cachedPythonCommand) return cachedPythonCommand;

  for (const candidate of PYTHON_CANDIDATES) {
    const [command, ...baseArgs] = candidate;
    const result = spawnSync(command, [...baseArgs, '--version'], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    if (result.status === 0) {
      cachedPythonCommand = candidate;
      return cachedPythonCommand;
    }
  }

  throw new Error(
    'Enterprise SQLite support requires Python 3 to be available when running on Node 20.'
  );
}

async function runSqliteCommand(mode, payload = null) {
  const { messageDbPath } = getEnterpriseConfig();
  ensureDatabaseDirectory(messageDbPath);
  const [command, ...baseArgs] = getPythonCommand();
  const args = [...baseArgs, '-c', PYTHON_SCRIPT, messageDbPath, mode];

  if (payload) {
    args.push(JSON.stringify(payload));
  }

  const { stdout } = await execFileAsync(command, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });

  return stdout.trim() ? JSON.parse(stdout) : null;
}

export async function listPolicyMessages() {
  return (await runSqliteCommand('list')) || [];
}

export async function insertPolicyMessage({ id, author, department, content, createdAt }) {
  return runSqliteCommand('insert', {
    id,
    author,
    department,
    content,
    createdAt,
  });
}
