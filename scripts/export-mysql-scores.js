const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const wxRepo = path.resolve(__dirname, '..');
const webRepo = process.env.LYRASCORE_WEB_REPO || 'D:\\07_codeProjects\\LyraScore_web';
const configPath = path.join(webRepo, 'backend', 'src', 'main', 'resources', 'application-dev.yml');
const startBatPath = path.join(webRepo, 'start.bat');
const uploadDir = path.join(webRepo, 'backend', 'uploads', 'scores');
const outputDir = path.join(wxRepo, '.migration');
const outputPath = path.join(outputDir, 'scores.json');
const validationPath = path.join(outputDir, 'validation.json');

function requiredMatch(text, pattern, label) {
  const match = text.match(pattern);
  if (!match) throw new Error(`无法从项目配置中读取${label}`);
  return match[1].trim().replace(/^"|"$/g, '');
}

const config = fs.readFileSync(configPath, 'utf8');
const startBat = fs.readFileSync(startBatPath, 'utf8');
const username = requiredMatch(config, /^\s*username:\s*(.+?)\s*$/m, '数据库用户名');
const password = requiredMatch(startBat, /^\s*set\s+"?DB_PASSWORD=(.*?)"?\s*$/im, '数据库密码');

const sql = `
SELECT JSON_OBJECT(
  'sourceId', id,
  'title', title,
  'artist', artist,
  'imageUrl', image_url,
  'tuning', tuning,
  'capo', capo,
  'bpm', bpm,
  'practiceStatus', practice_status,
  'instrument', instrument,
  'style', style,
  'memo', memo,
  'createdAt', DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s')
)
FROM lyrascore.t_score
WHERE user_id = 4
ORDER BY id;
`;

const raw = execFileSync('mysql', [
  '--default-character-set=utf8mb4',
  '-u', username,
  '--batch',
  '--raw',
  '--skip-column-names',
  '-e', sql,
], {
  encoding: 'utf8',
  env: { ...process.env, MYSQL_PWD: password },
  maxBuffer: 10 * 1024 * 1024,
});

const sourceRows = raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const referencedFiles = new Set();

const records = sourceRows.map(row => {
  const imageFiles = String(row.imageUrl || '')
    .split(',')
    .map(value => path.basename(value.trim()))
    .filter(Boolean);
  imageFiles.forEach(file => referencedFiles.add(file));

  return {
    source: 'lyrascore_web',
    sourceId: Number(row.sourceId),
    id: 2000000000000 + Number(row.sourceId),
    type: 'image',
    status: Number(row.practiceStatus) === 2 ? 'finished' : 'practicing',
    title: row.title || '',
    artist: row.artist || '',
    instrument: row.instrument || '吉他',
    style: row.style || '弹唱',
    comment: row.memo || '',
    tuning: row.tuning || '标准',
    capo: row.capo == null ? 0 : Number(row.capo),
    bpm: row.bpm == null ? 90 : Number(row.bpm),
    key: 'C',
    originalKey: 'C',
    timeSignature: '4/4',
    content: '',
    location: '',
    filePaths: [],
    createTime: row.createdAt || '',
    updateTime: Date.now(),
    imageFiles,
  };
});

const missingFiles = [...referencedFiles].filter(file => !fs.existsSync(path.join(uploadDir, file)));
const allFiles = fs.readdirSync(uploadDir, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name);
const unreferencedFiles = allFiles.filter(file => !referencedFiles.has(file));
const duplicateSourceIds = records
  .map(record => record.sourceId)
  .filter((id, index, values) => values.indexOf(id) !== index);

const validation = {
  generatedAt: new Date().toISOString(),
  database: 'lyrascore',
  sourceTable: 't_score',
  sourceUserId: 4,
  recordCount: records.length,
  referencedFileCount: referencedFiles.size,
  uploadDirectoryFileCount: allFiles.length,
  missingFiles,
  unreferencedFiles,
  duplicateSourceIds,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf8');
fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2), 'utf8');

console.log(JSON.stringify(validation, null, 2));
if (records.length !== 54 || missingFiles.length || duplicateSourceIds.length) process.exitCode = 1;
