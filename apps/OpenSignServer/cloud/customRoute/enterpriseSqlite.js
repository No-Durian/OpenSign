import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { getEnterpriseConfig } from './enterpriseConfig.js';

let db;
let initialized = false;

function ensureDatabaseDirectory(dbPath) {
  const directory = path.dirname(dbPath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function initializeDatabase(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS policy_messages (
      id TEXT PRIMARY KEY,
      author TEXT NOT NULL,
      department TEXT DEFAULT '',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_policy_messages_created_at
    ON policy_messages(created_at DESC);
  `);
}

export function getEnterpriseDatabase() {
  if (!db) {
    const { messageDbPath } = getEnterpriseConfig();
    ensureDatabaseDirectory(messageDbPath);
    db = new DatabaseSync(messageDbPath);
  }
  if (!initialized) {
    initializeDatabase(db);
    initialized = true;
  }
  return db;
}

export function listPolicyMessages() {
  const database = getEnterpriseDatabase();
  return database
    .prepare(
      `SELECT id, author, department, content, created_at AS createdAt
       FROM policy_messages
       ORDER BY datetime(created_at) DESC, rowid DESC`
    )
    .all();
}

export function insertPolicyMessage({ id, author, department, content, createdAt }) {
  const database = getEnterpriseDatabase();
  database
    .prepare(
      `INSERT INTO policy_messages (id, author, department, content, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, author, department, content, createdAt);

  return {
    id,
    author,
    department,
    content,
    createdAt,
  };
}
