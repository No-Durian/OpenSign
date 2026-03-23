import express from 'express';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let XLSX;
try {
  XLSX = require('../../../OpenSign/node_modules/xlsx');
} catch (error) {
  console.warn('xlsx dependency unavailable for enterprise routes:', error?.message);
}

const router = express.Router();
const DEFAULT_LIBRARY_PATH = 'C:/Users/TCT/Desktop/制度/制度内容';
const DEFAULT_EXPIRY_PATH = 'C:/Users/TCT/Desktop/制度/检查过期文件';
const DEFAULT_MANAGEMENT_PATH = 'C:/Users/TCT/Desktop/制度/制度管理';
const DEFAULT_MESSAGE_FILE = path.resolve('data/enterprise-messages.json');
const DEFAULT_AI_URL = 'http://172.18.66.18/chat/rmh1ZG3tZOU30MdH';
const SUPPORTED_POLICY_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
]);

function getConfig() {
  return {
    libraryRoot: process.env.ENTERPRISE_POLICY_LIBRARY_PATH || DEFAULT_LIBRARY_PATH,
    expiryRoot: process.env.ENTERPRISE_POLICY_EXPIRY_PATH || DEFAULT_EXPIRY_PATH,
    managementRoot: process.env.ENTERPRISE_POLICY_MANAGEMENT_PATH || DEFAULT_MANAGEMENT_PATH,
    messageFile: process.env.ENTERPRISE_MESSAGE_BOARD_FILE || DEFAULT_MESSAGE_FILE,
    aiAssistantUrl: process.env.ENTERPRISE_AI_ASSISTANT_URL || DEFAULT_AI_URL,
  };
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isAllowedDocument(fileName) {
  return SUPPORTED_POLICY_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return null;
}

function parseExcelDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && XLSX?.SSF?.parse_date_code) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed
      .replace(/[年/.]/g, '-')
      .replace(/月/g, '-')
      .replace(/日/g, '');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function calculateExpiryStatus(expiryDate) {
  if (!expiryDate) return { bucket: 'unknown', daysLeft: null };
  const today = startOfToday();
  const target = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { bucket: 'expired', daysLeft: diffDays };
  if (diffDays <= 30) return { bucket: 'within1Month', daysLeft: diffDays };
  if (diffDays <= 90) return { bucket: 'within3Months', daysLeft: diffDays };
  if (diffDays <= 180) return { bucket: 'within6Months', daysLeft: diffDays };
  if (diffDays <= 365) return { bucket: 'within1Year', daysLeft: diffDays };
  return { bucket: 'later', daysLeft: diffDays };
}

function normalizeWorkbookRow(row) {
  const title = row['制度简称'] || row['制度名称'] || row['文件名称'] || row['标题'] || '';
  const department = row['发布部门'] || row['部门'] || '';
  const docNo = row['文号'] || row['制度编号'] || '';
  const category = row['制度分类'] || row['分类'] || '';
  const publishedAt = parseExcelDate(row['发布时间'] || row['发布日期']);
  const expiryDate = parseExcelDate(row['有效期'] || row['到期时间']);
  const remark = row['备注'] || '';
  const status = calculateExpiryStatus(expiryDate);

  return {
    serial: row['序号'] || row['编号'] || '',
    department,
    title,
    docNo,
    category,
    publishedAt: toIsoDate(publishedAt),
    publishedYear: publishedAt ? String(publishedAt.getFullYear()) : '',
    expiryDate: toIsoDate(expiryDate),
    remark,
    status: status.bucket,
    daysLeft: status.daysLeft,
  };
}

async function readFirstWorkbook(expiryRoot) {
  if (!XLSX || !(await pathExists(expiryRoot))) return [];
  const entries = await fs.readdir(expiryRoot, { withFileTypes: true });
  const workbookFile = entries
    .filter(entry => entry.isFile())
    .find(entry => ['.xlsx', '.xls', '.xlsm'].includes(path.extname(entry.name).toLowerCase()));

  if (!workbookFile) return [];

  const workbookPath = path.join(expiryRoot, workbookFile.name);
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.map(normalizeWorkbookRow).filter(item => item.title);
}

async function listFilesRecursively(targetPath, rootPath, libraryName) {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(absolutePath, rootPath, libraryName)));
      continue;
    }
    if (!isAllowedDocument(entry.name)) continue;
    const stats = await fs.stat(absolutePath);
    files.push({
      fileName: entry.name,
      title: path.parse(entry.name).name,
      relativePath: path.relative(rootPath, absolutePath),
      libraryName,
      modifiedAt: stats.mtime.toISOString(),
      absolutePath,
    });
  }

  return files;
}

async function getLibraries(libraryRoot) {
  if (!(await pathExists(libraryRoot))) return [];
  const entries = await fs.readdir(libraryRoot, { withFileTypes: true });
  const libraries = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const absolutePath = path.join(libraryRoot, entry.name);
    const files = await listFilesRecursively(absolutePath, libraryRoot, entry.name);
    const latest = files.reduce((max, current) => {
      if (!max) return current.modifiedAt;
      return new Date(current.modifiedAt) > new Date(max) ? current.modifiedAt : max;
    }, null);
    libraries.push({
      name: entry.name,
      fileCount: files.length,
      latestModifiedAt: latest,
      sampleFiles: files.slice(0, 5).map(file => ({
        title: file.title,
        relativePath: file.relativePath,
      })),
      files,
    });
  }

  return libraries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

function buildFileLookup(libraries) {
  return libraries
    .flatMap(library => library.files)
    .map(file => ({
      ...file,
      normalizedTitle: file.title.toLowerCase(),
      normalizedName: file.fileName.toLowerCase(),
    }));
}

function matchPolicyFile(fileLookup, title, docNo, libraryName) {
  const titleLower = (title || '').toLowerCase();
  const docNoLower = (docNo || '').toLowerCase();
  const scopedFiles = libraryName
    ? fileLookup.filter(item => item.libraryName === libraryName)
    : fileLookup;

  return (
    scopedFiles.find(
      file =>
        titleLower &&
        (file.normalizedTitle.includes(titleLower) || titleLower.includes(file.normalizedTitle))
    ) ||
    scopedFiles.find(file => docNoLower && file.normalizedName.includes(docNoLower)) ||
    null
  );
}

function formatDateCN(value) {
  if (!value) return '未获取';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未获取';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

async function getOverviewData() {
  const { libraryRoot, expiryRoot, aiAssistantUrl } = getConfig();
  const libraries = await getLibraries(libraryRoot);
  const fileLookup = buildFileLookup(libraries);
  const expiryRecords = await readFirstWorkbook(expiryRoot);
  const expiredRecords = expiryRecords.filter(item => item.status === 'expired');
  const upcomingRecords = expiryRecords.filter(
    item => item.status !== 'expired' && item.status !== 'later' && item.status !== 'unknown'
  );
  const latestLibraryUpdate =
    libraries
      .map(item => item.latestModifiedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  return {
    config: {
      libraryRoot,
      expiryRoot,
      aiAssistantUrl,
    },
    libraryCount: libraries.length,
    latestLibraryUpdate,
    latestLibraryUpdateLabel: formatDateCN(latestLibraryUpdate),
    libraries: libraries.map(library => ({
      name: library.name,
      fileCount: library.fileCount,
      latestModifiedAt: library.latestModifiedAt,
      latestModifiedAtLabel: formatDateCN(library.latestModifiedAt),
      sampleFiles: library.sampleFiles,
    })),
    expired: expiredRecords
      .sort((a, b) => new Date(a.expiryDate || 0) - new Date(b.expiryDate || 0))
      .slice(0, 10)
      .map(item => ({ ...item, file: matchPolicyFile(fileLookup, item.title, item.docNo, null) })),
    upcoming: upcomingRecords
      .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
      .slice(0, 10)
      .map(item => ({ ...item, file: matchPolicyFile(fileLookup, item.title, item.docNo, null) })),
  };
}

async function getSearchPayload(filters = {}) {
  const { libraryRoot, expiryRoot } = getConfig();
  const libraries = await getLibraries(libraryRoot);
  const fileLookup = buildFileLookup(libraries);
  const rows = await readFirstWorkbook(expiryRoot);
  const keyword = (filters.keyword || '').trim().toLowerCase();
  const selectedLibrary = filters.library || '';
  const selectedDepartment = filters.department || '';
  const selectedYear = filters.year || '';
  const selectedCategory = filters.category || '';

  const filteredRows = rows.filter(item => {
    if (selectedDepartment && item.department !== selectedDepartment) return false;
    if (selectedYear && item.publishedYear !== selectedYear) return false;
    if (selectedCategory && item.category !== selectedCategory) return false;
    const matchedFile = matchPolicyFile(
      fileLookup,
      item.title,
      item.docNo,
      selectedLibrary || null
    );
    if (selectedLibrary && !matchedFile) return false;
    if (keyword) {
      const haystack = [
        item.title,
        item.department,
        item.docNo,
        item.category,
        matchedFile?.fileName,
        matchedFile?.libraryName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });

  const results = filteredRows.map(item => {
    const file = matchPolicyFile(fileLookup, item.title, item.docNo, selectedLibrary || null);
    return {
      ...item,
      libraryName: file?.libraryName || '未匹配知识库',
      fileName: file?.fileName || '',
      relativePath: file?.relativePath || '',
      canPreview: Boolean(file?.relativePath),
    };
  });

  return {
    filters: {
      libraries: libraries.map(item => item.name),
      departments: [...new Set(rows.map(item => item.department).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'zh-CN')
      ),
      years: [...new Set(rows.map(item => item.publishedYear).filter(Boolean))].sort((a, b) =>
        b.localeCompare(a, 'zh-CN')
      ),
      categories: [...new Set(rows.map(item => item.category).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'zh-CN')
      ),
    },
    total: results.length,
    results,
  };
}

async function readManagementData() {
  const { managementRoot } = getConfig();
  const groups = {
    newItems: ['新增', '新增文件'],
    modifiedItems: ['有修改', '修改', '修订'],
    abolishedItems: ['废止', '作废'],
  };

  const payload = {
    rootPath: managementRoot,
    newItems: [],
    modifiedItems: [],
    abolishedItems: [],
    summary: {
      newItems: 0,
      modifiedItems: 0,
      abolishedItems: 0,
    },
  };

  if (!(await pathExists(managementRoot))) {
    return payload;
  }

  const entries = await fs.readdir(managementRoot, { withFileTypes: true });
  for (const [key, aliases] of Object.entries(groups)) {
    const matchedDirectory = entries.find(
      entry => entry.isDirectory() && aliases.includes(entry.name)
    );
    if (!matchedDirectory) continue;
    const files = await listFilesRecursively(
      path.join(managementRoot, matchedDirectory.name),
      managementRoot,
      matchedDirectory.name
    );
    payload[key] = files.map(file => ({
      title: file.title,
      fileName: file.fileName,
      relativePath: file.relativePath,
      modifiedAt: file.modifiedAt,
    }));
    payload.summary[key] = payload[key].length;
  }

  return payload;
}

async function ensureMessageFile(filePath) {
  const dirPath = path.dirname(filePath);
  if (!fssync.existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true });
  }
  if (!fssync.existsSync(filePath)) {
    await fs.writeFile(filePath, '[]', 'utf8');
  }
}

async function readMessages() {
  const { messageFile } = getConfig();
  await ensureMessageFile(messageFile);
  const content = await fs.readFile(messageFile, 'utf8');
  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeMessages(messages) {
  const { messageFile } = getConfig();
  await ensureMessageFile(messageFile);
  await fs.writeFile(messageFile, JSON.stringify(messages, null, 2), 'utf8');
}

function isAdminRole(role) {
  return ['admin', 'contracts_Admin', 'contracts_OrgAdmin'].includes(role);
}

router.get('/overview', async (_req, res) => {
  try {
    const payload = await getOverviewData();
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: '读取制度门户数据失败。', details: error.message });
  }
});

router.get('/search/options', async (_req, res) => {
  try {
    const payload = await getSearchPayload();
    res.json(payload.filters);
  } catch (error) {
    res.status(500).json({ message: '读取筛选条件失败。', details: error.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const payload = await getSearchPayload(req.query);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: '查询制度失败。', details: error.message });
  }
});

router.get('/management', async (_req, res) => {
  try {
    const payload = await readManagementData();
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: '读取制度管理数据失败。', details: error.message });
  }
});

router.get('/messages', async (req, res) => {
  try {
    const role = req.headers['x-enterprise-role'] || req.query.role;
    if (!isAdminRole(role)) {
      return res.status(403).json({ message: '仅管理员可查看全部留言。' });
    }
    const messages = await readMessages();
    res.json(messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (error) {
    res.status(500).json({ message: '读取留言失败。', details: error.message });
  }
});

router.post('/messages', async (req, res) => {
  try {
    const { author = '匿名用户', department = '', content = '' } = req.body || {};
    if (!content.trim()) {
      return res.status(400).json({ message: '留言内容不能为空。' });
    }
    const messages = await readMessages();
    const message = {
      id: `msg_${Date.now()}`,
      author: author.trim() || '匿名用户',
      department: department.trim(),
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    messages.push(message);
    await writeMessages(messages);
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: '提交留言失败。', details: error.message });
  }
});

router.get('/assistant', (_req, res) => {
  const { aiAssistantUrl } = getConfig();
  res.json({ url: aiAssistantUrl });
});

router.get('/file', async (req, res) => {
  try {
    const { libraryRoot, managementRoot } = getConfig();
    const scope = req.query.scope || 'library';
    const relativePath = req.query.relativePath;
    if (!relativePath) {
      return res.status(400).json({ message: '缺少文件路径。' });
    }
    const root = scope === 'management' ? managementRoot : libraryRoot;
    const resolvedRoot = path.resolve(root);
    const resolvedFile = path.resolve(root, relativePath);
    if (!resolvedFile.startsWith(resolvedRoot)) {
      return res.status(403).json({ message: '非法文件路径。' });
    }
    if (!(await pathExists(resolvedFile))) {
      return res.status(404).json({ message: '文件不存在。' });
    }
    res.sendFile(resolvedFile);
  } catch (error) {
    res.status(500).json({ message: '读取文件失败。', details: error.message });
  }
});

export default router;
