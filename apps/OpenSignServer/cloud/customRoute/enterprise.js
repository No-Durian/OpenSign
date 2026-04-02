import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

import { getEnterpriseConfig, saveEnterpriseConfig } from './enterpriseConfig.js';

const require = createRequire(import.meta.url);

function loadXlsxModule() {
  const candidates = [
    'xlsx',
    '../../../OpenSign/node_modules/xlsx',
    '../../../../node_modules/xlsx',
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next candidate
    }
  }
  return null;
}

const XLSX = loadXlsxModule();
if (!XLSX) {
  console.warn(
    'xlsx dependency unavailable for enterprise routes. Install xlsx in OpenSignServer dependencies.'
  );
}

const router = express.Router();
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
const WORKBOOK_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsm']);
const HEADER_ALIASES = {
  serial: ['序号', '编号', '序', 'serial'],
  title: [
    '制度简称',
    '制度名称',
    '文件名称',
    '文件名',
    '标题',
    '名称',
    '制度标题',
    '制度',
    'policytitle',
  ],
  department: ['发布部门', '部门', '归口部门', '所属部门', '责任部门', '起草部门'],
  docNo: ['文号', '制度编号', '编号文号', '发文字号', '文件编号', '文件文号'],
  category: ['制度分类', '分类', '类别', '业务分类', '制度类别'],
  publishedAt: ['发布时间', '发布日期', '印发日期', '发文日期', '生效日期', '发布日期时间'],
  publishedYear: ['发布年份', '年份', '年度', '印发年份'],
  expiryDate: ['有效期', '到期时间', '到期日期', '失效日期', '废止日期', '截止日期'],
  remark: ['备注', '说明', '备注说明'],
  libraryHint: ['制度库', '数据库', '知识库', '所属制度库', '所属库', '库名称'],
  originalFileName: ['原文文件名', '制度原文', '原文名称', '原文文件', '附件名称', '文件路径'],
  originalRelativePath: ['原文相对路径', '相对路径', '制度路径', '路径', '文件相对路径'],
};

const NORMALIZED_HEADER_ALIASES = Object.fromEntries(
  Object.entries(HEADER_ALIASES).map(([field, aliases]) => [field, aliases.map(normalizeText)])
);

function detectHeaderRowIndex(matrixRows) {
  for (let rowIndex = 0; rowIndex < matrixRows.length; rowIndex += 1) {
    const row = matrixRows[rowIndex] || [];
    const normalizedCells = row.map(cell => normalizeText(cell)).filter(Boolean);
    if (!normalizedCells.length) continue;

    let matchedFields = 0;
    for (const aliases of Object.values(NORMALIZED_HEADER_ALIASES)) {
      if (
        aliases.some(alias => normalizedCells.some(cell => cell === alias || cell.includes(alias)))
      ) {
        matchedFields += 1;
      }
    }

    const hasTitleHeader = NORMALIZED_HEADER_ALIASES.title.some(alias =>
      normalizedCells.some(cell => cell === alias || cell.includes(alias))
    );

    if (hasTitleHeader && matchedFields >= 3) {
      return rowIndex;
    }
  }
  return -1;
}

function sheetToRowObjects(sheet) {
  const matrixRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  if (!matrixRows.length) return [];

  const headerRowIndex = detectHeaderRowIndex(matrixRows);
  if (headerRowIndex < 0) {
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  const headers = (matrixRows[headerRowIndex] || []).map((value, index) => {
    const headerName = String(value || '').trim();
    return headerName || `列${index + 1}`;
  });

  const rows = [];
  for (let idx = headerRowIndex + 1; idx < matrixRows.length; idx += 1) {
    const values = matrixRows[idx] || [];
    const hasValue = values.some(value => String(value || '').trim());
    if (!hasValue) continue;

    const rowObject = {};
    headers.forEach((header, colIndex) => {
      rowObject[header] = values[colIndex] ?? '';
    });
    rowObject.__rowNumber = idx + 1;
    rows.push(rowObject);
  }

  return rows;
}

function pathExists(targetPath) {
  return fs.access(targetPath).then(
    () => true,
    () => false
  );
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[()（）\[\]【】{}《》'"“”‘’`~!@#$%^&*+=|\\/:;,.?<>，。！？；：、-]+/g, '');
}

function stripExtension(fileName) {
  return String(fileName || '').replace(/\.[^.]+$/, '');
}

function getRowValue(row, fieldName) {
  const aliases = (HEADER_ALIASES[fieldName] || []).map(normalizeText);
  const entries = Object.entries(row || {}).filter(([, value]) => String(value || '').trim());
  for (const [key, value] of entries) {
    const normalizedKey = normalizeText(key);
    if (!normalizedKey) continue;
    if (aliases.includes(normalizedKey)) return value;
  }
  for (const [key, value] of entries) {
    const normalizedKey = normalizeText(key);
    if (!normalizedKey) continue;
    if (aliases.some(alias => normalizedKey.includes(alias) || alias.includes(normalizedKey))) {
      return value;
    }
  }
  return '';
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
      .replace(/日/g, '')
      .replace(/--+/g, '-');
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

function formatDateCN(value) {
  if (!value) return '未获取';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未获取';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function normalizeWorkbookRow(row, context = {}) {
  const rawTitle = getRowValue(row, 'title');
  const rawOriginalFileName = getRowValue(row, 'originalFileName');
  const originalRelativePath = getRowValue(row, 'originalRelativePath');
  const publishedAt = parseExcelDate(getRowValue(row, 'publishedAt'));
  const explicitPublishedYear = String(getRowValue(row, 'publishedYear') || '').trim();
  const expiryDate = parseExcelDate(getRowValue(row, 'expiryDate'));
  const status = calculateExpiryStatus(expiryDate);
  const title = String(
    rawTitle || stripExtension(path.basename(rawOriginalFileName || '')) || ''
  ).trim();
  const publishedYear = publishedAt
    ? String(publishedAt.getFullYear())
    : explicitPublishedYear
      ? explicitPublishedYear.replace(/[^\d]/g, '').slice(0, 4)
      : '';

  return {
    serial: String(getRowValue(row, 'serial') || '').trim(),
    department: String(getRowValue(row, 'department') || '').trim(),
    title,
    docNo: String(getRowValue(row, 'docNo') || '').trim(),
    category: String(getRowValue(row, 'category') || '').trim(),
    publishedAt: toIsoDate(publishedAt),
    publishedYear,
    expiryDate: toIsoDate(expiryDate),
    remark: String(getRowValue(row, 'remark') || '').trim(),
    status: status.bucket,
    daysLeft: status.daysLeft,
    libraryHint: String(getRowValue(row, 'libraryHint') || '').trim(),
    originalFileName: String(rawOriginalFileName || '').trim(),
    originalRelativePath: String(originalRelativePath || '').trim(),
    sourceWorkbook: context.workbookName || '',
    sourceSheet: context.sheetName || '',
    sourceRowNumber: context.rowNumber || null,
  };
}

async function listFilesRecursively(targetPath, rootPath, libraryName, allowedExtensions) {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(
        ...(await listFilesRecursively(absolutePath, rootPath, libraryName, allowedExtensions))
      );
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (!allowedExtensions.has(extension)) continue;
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
    const files = await listFilesRecursively(
      absolutePath,
      libraryRoot,
      entry.name,
      SUPPORTED_POLICY_EXTENSIONS
    );
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
  return libraries.flatMap(library =>
    library.files.map(file => ({
      ...file,
      normalizedTitle: normalizeText(file.title),
      normalizedFileName: normalizeText(file.fileName),
      normalizedRelativePath: normalizeText(file.relativePath),
    }))
  );
}

function getBestMatch(fileLookup, metadata = {}, preferredLibraryName = '') {
  const titleText = normalizeText(metadata.title);
  const docNoText = normalizeText(metadata.docNo);
  const originalFileNameText = normalizeText(metadata.originalFileName);
  const originalFileBaseText = normalizeText(stripExtension(metadata.originalFileName));
  const originalRelativePathText = normalizeText(metadata.originalRelativePath);
  const libraryHintText = preferredLibraryName || metadata.libraryHint || '';
  const scopedFiles = preferredLibraryName
    ? fileLookup.filter(item => item.libraryName === preferredLibraryName)
    : fileLookup;

  let bestMatch = null;
  let bestScore = 0;
  let bestReason = '';

  for (const file of scopedFiles) {
    let score = 0;
    let reason = '';

    if (libraryHintText && file.libraryName === libraryHintText) {
      score += 40;
      reason = reason || '制度库匹配';
    }
    if (originalRelativePathText) {
      if (file.normalizedRelativePath === originalRelativePathText) {
        score += 300;
        reason = '相对路径精确匹配';
      } else if (file.normalizedRelativePath.includes(originalRelativePathText)) {
        score += 220;
        reason = reason || '相对路径包含匹配';
      }
    }
    if (originalFileNameText) {
      if (file.normalizedFileName === originalFileNameText) {
        score += 260;
        reason = '原文文件名精确匹配';
      } else if (file.normalizedFileName.includes(originalFileNameText)) {
        score += 180;
        reason = reason || '原文文件名包含匹配';
      }
    }
    if (originalFileBaseText) {
      if (file.normalizedTitle === originalFileBaseText) {
        score += 240;
        reason = reason || '原文标题精确匹配';
      } else if (
        file.normalizedTitle.includes(originalFileBaseText) ||
        originalFileBaseText.includes(file.normalizedTitle)
      ) {
        score += 160;
        reason = reason || '原文标题模糊匹配';
      }
    }
    if (titleText) {
      if (file.normalizedTitle === titleText) {
        score += 220;
        reason = reason || '制度简称精确匹配';
      } else if (
        file.normalizedTitle.includes(titleText) ||
        titleText.includes(file.normalizedTitle)
      ) {
        score += 150;
        reason = reason || '制度简称模糊匹配';
      }
    }
    if (
      docNoText &&
      (file.normalizedFileName.includes(docNoText) ||
        file.normalizedRelativePath.includes(docNoText))
    ) {
      score += 170;
      reason = reason || '文号匹配';
    }

    if (score > bestScore) {
      bestScore = score;
      bestReason = reason;
      bestMatch = file;
    }
  }

  if (!bestMatch || bestScore <= 0) return null;
  return {
    ...bestMatch,
    matchedBy: bestReason || '模糊匹配',
    score: bestScore,
  };
}

async function readWorkbookRecords(expiryRoot) {
  if (!XLSX || !(await pathExists(expiryRoot))) return [];
  const workbookFiles = await listFilesRecursively(
    expiryRoot,
    expiryRoot,
    '台账',
    WORKBOOK_EXTENSIONS
  );
  const rows = [];

  for (const workbookFile of workbookFiles) {
    try {
      const workbook = XLSX.readFile(workbookFile.absolutePath, { cellDates: true });
      for (const sheetName of workbook.SheetNames || []) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const sheetRows = sheetToRowObjects(sheet);
        sheetRows.forEach((row, index) => {
          const normalized = normalizeWorkbookRow(row, {
            workbookName: workbookFile.fileName,
            sheetName,
            rowNumber: row.__rowNumber || index + 2,
          });
          if (normalized.title || normalized.originalFileName || normalized.docNo) {
            rows.push(normalized);
          }
        });
      }
    } catch (error) {
      console.warn(
        `failed to read enterprise workbook: ${workbookFile.absolutePath}`,
        error?.message
      );
    }
  }

  return rows;
}

async function getOverviewData() {
  const { libraryRoot, expiryRoot, managementRoot, aiAssistantUrl } = await getEnterpriseConfig();
  const libraries = await getLibraries(libraryRoot);
  const fileLookup = buildFileLookup(libraries);
  const expiryRecords = await readWorkbookRecords(expiryRoot);
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
      managementRoot,
      aiAssistantUrl,
      xlsxAvailable: Boolean(XLSX),
    },
    libraryCount: libraries.length,
    workbookRecordCount: expiryRecords.length,
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
      .map(item => ({ ...item, file: getBestMatch(fileLookup, item) })),
    upcoming: upcomingRecords
      .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
      .slice(0, 10)
      .map(item => ({ ...item, file: getBestMatch(fileLookup, item) })),
  };
}

async function getSearchPayload(filters = {}) {
  const { libraryRoot, expiryRoot } = await getEnterpriseConfig();
  const libraries = await getLibraries(libraryRoot);
  const fileLookup = buildFileLookup(libraries);
  const rows = await readWorkbookRecords(expiryRoot);
  const keyword = String(filters.keyword || '')
    .trim()
    .toLowerCase();
  const selectedLibrary = String(filters.library || '').trim();
  const selectedDepartment = String(filters.department || '').trim();
  const selectedYear = String(filters.year || '').trim();
  const selectedCategory = String(filters.category || '').trim();

  const results = rows
    .map(item => {
      const file = getBestMatch(fileLookup, item, selectedLibrary);
      return {
        ...item,
        libraryName: file?.libraryName || item.libraryHint || '未匹配制度库',
        fileName: file?.fileName || item.originalFileName || '',
        relativePath: file?.relativePath || item.originalRelativePath || '',
        canPreview: Boolean(file?.relativePath),
        matchedBy: file?.matchedBy || '',
      };
    })
    .filter(item => {
      if (selectedLibrary && item.libraryName !== selectedLibrary) return false;
      if (selectedDepartment && item.department !== selectedDepartment) return false;
      if (selectedYear && item.publishedYear !== selectedYear) return false;
      if (selectedCategory && item.category !== selectedCategory) return false;
      if (!keyword) return true;
      const haystack = [
        item.title,
        item.department,
        item.docNo,
        item.category,
        item.publishedYear,
        item.fileName,
        item.libraryName,
        item.relativePath,
        item.sourceWorkbook,
        item.sourceSheet,
        item.remark,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
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
    xlsxAvailable: Boolean(XLSX),
  };
}

async function readManagementData() {
  const { managementRoot } = await getEnterpriseConfig();
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
      matchedDirectory.name,
      SUPPORTED_POLICY_EXTENSIONS
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

router.get('/overview', async (_req, res) => {
  try {
    const payload = await getOverviewData();
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: '读取制度门户数据失败。', details: error.message });
  }
});

router.get('/config', async (_req, res) => {
  const config = await getEnterpriseConfig();
  res.json({
    ...config,
    xlsxAvailable: Boolean(XLSX),
  });
});

async function updateConfigHandler(req, res) {
  try {
    const libraryRoot = String(req.body?.libraryRoot || '').trim();
    const expiryRoot = String(req.body?.expiryRoot || '').trim();
    const managementRoot = String(req.body?.managementRoot || '').trim();
    const aiAssistantUrl = String(req.body?.aiAssistantUrl || '').trim();

    const nextConfig = {};
    if (libraryRoot) nextConfig.libraryRoot = libraryRoot;
    if (expiryRoot) nextConfig.expiryRoot = expiryRoot;
    if (managementRoot) nextConfig.managementRoot = managementRoot;
    if (aiAssistantUrl) nextConfig.aiAssistantUrl = aiAssistantUrl;

    if (!Object.keys(nextConfig).length) {
      return res.status(400).json({ message: '未提供可更新的配置项。' });
    }

    const saved = await saveEnterpriseConfig(nextConfig);
    res.json({
      ...saved,
      xlsxAvailable: Boolean(XLSX),
    });
  } catch (error) {
    res.status(500).json({ message: '更新制度配置失败。', details: error.message });
  }
}

router.post('/config', updateConfigHandler);
router.put('/config', updateConfigHandler);
router.post('/config/update', updateConfigHandler);

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

router.get('/assistant', async (_req, res) => {
  const { aiAssistantUrl } = await getEnterpriseConfig();
  res.json({ url: aiAssistantUrl });
});

function normalizeRelativePathForFilesystem(relativePath) {
  return String(relativePath || '')
    .replaceAll('\\', path.sep)
    .replaceAll('/', path.sep);
}

async function findLibraryFileByName(fileLookup, fileName, preferredLibrary = '') {
  const name = String(fileName || '').trim();
  if (!name) return null;
  const normalizedName = normalizeText(name);
  const normalizedBase = normalizeText(stripExtension(name));
  const scopedFiles = preferredLibrary
    ? fileLookup.filter(item => item.libraryName === preferredLibrary)
    : fileLookup;

  return (
    scopedFiles.find(item => item.normalizedFileName === normalizedName) ||
    scopedFiles.find(item => item.normalizedTitle === normalizedBase) ||
    scopedFiles.find(
      item =>
        normalizedName &&
        (item.normalizedFileName.includes(normalizedName) ||
          normalizedName.includes(item.normalizedFileName))
    ) ||
    null
  );
}

router.get('/file-by-name', async (req, res) => {
  try {
    const { libraryRoot } = await getEnterpriseConfig();
    const fileName = req.query.fileName;
    const library = String(req.query.library || '').trim();
    if (!fileName) {
      return res.status(400).json({ message: '缺少文件名。' });
    }

    const libraries = await getLibraries(libraryRoot);
    const fileLookup = buildFileLookup(libraries);
    const file = await findLibraryFileByName(fileLookup, fileName, library);
    if (!file) {
      return res.status(404).json({ message: '未找到对应制度原文文件。' });
    }

    const resolvedRoot = path.resolve(libraryRoot);
    const resolvedFile = path.resolve(file.absolutePath);
    if (!resolvedFile.startsWith(resolvedRoot)) {
      return res.status(403).json({ message: '非法文件路径。' });
    }

    res.sendFile(resolvedFile);
  } catch (error) {
    res.status(500).json({ message: '按文件名读取制度文件失败。', details: error.message });
  }
});

router.get('/file', async (req, res) => {
  try {
    const { libraryRoot, managementRoot } = await getEnterpriseConfig();
    const scope = req.query.scope || 'library';
    const relativePath = normalizeRelativePathForFilesystem(req.query.relativePath);
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
