const fs = require('fs');
const http = require('http');
const path = require('path');

const wxRepo = path.resolve(__dirname, '..');
const webRepo = process.env.LYRASCORE_WEB_REPO || 'D:\\07_codeProjects\\LyraScore_web';
const manifestPath = path.join(wxRepo, '.migration', 'scores.json');
const uploadDir = path.join(webRepo, 'backend', 'uploads', 'scores');
const host = '127.0.0.1';
const port = Number(process.env.LYRASCORE_MIGRATION_PORT || 8765);

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function send(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`);
  if (url.pathname === '/health') return send(res, 200, 'ok');
  if (url.pathname === '/scores.json') {
    if (!fs.existsSync(manifestPath)) return send(res, 404, '请先运行导出脚本');
    return send(res, 200, fs.readFileSync(manifestPath), 'application/json; charset=utf-8');
  }
  if (url.pathname.startsWith('/files/')) {
    const filename = path.basename(decodeURIComponent(url.pathname.slice('/files/'.length)));
    const filePath = path.join(uploadDir, filename);
    if (!filename || !fs.existsSync(filePath)) return send(res, 404, 'file not found');
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    return fs.createReadStream(filePath).pipe(res);
  }
  return send(res, 404, 'not found');
});

server.listen(port, host, () => {
  console.log(`LyraScore migration server: http://${host}:${port}`);
  console.log(`Manifest: http://${host}:${port}/scores.json`);
});
