const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const rootDir = __dirname;
const port = process.env.PORT || 3000;
const authPort = process.env.AUTH_PORT || 3101;
const forumPort = process.env.FORUM_PORT || 3102;
const studyPort = process.env.STUDY_PORT || 3103;

const childProcesses = [];

function resolveExistingPath(...segments) {
  const candidates = [
    path.join(__dirname, ...segments),
    path.join(process.cwd(), ...segments),
    path.resolve(__dirname, '..', ...segments)
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function startChild(label, scriptPath, portNumber) {
  if (!scriptPath || !fs.existsSync(scriptPath)) {
    console.warn(`[${label}] skipped: ${scriptPath || 'missing path'} not found`);
    return null;
  }

  const child = spawn(process.execPath, [scriptPath], {
    cwd: path.dirname(scriptPath),
    env: { ...process.env, PORT: String(portNumber) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(`[${label}] ${data}`);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(`[${label}] ${data}`);
  });

  child.on('exit', (code) => {
    console.log(`[${label}] exited with code ${code}`);
  });

  childProcesses.push(child);
  return child;
}

function stopChildren() {
  childProcesses.forEach((child) => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  });
}

const authScriptPath = resolveExistingPath('Frontend-SignIn', 'server.js');
const forumScriptPath = resolveExistingPath('Frontend-Forum', 'ForumServer.js');
const studyScriptPath = resolveExistingPath('Frontend-StudyAss', 'server.js');

startChild('auth', authScriptPath, authPort);
startChild('forum', forumScriptPath, forumPort);
startChild('study', studyScriptPath, studyPort);

process.on('SIGINT', () => {
  stopChildren();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopChildren();
  process.exit(0);
});

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const materialsDir = path.join(rootDir, 'uploads', 'materials');
const materialsDbPath = path.join(rootDir, 'Frontend-Acada', 'materials.db');
const materialsDb = new DatabaseSync(materialsDbPath);

function ensureMaterialsStore() {
  fs.mkdirSync(materialsDir, { recursive: true });
  materialsDb.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      course TEXT NOT NULL,
      category TEXT NOT NULL,
      dueDate TEXT,
      professor TEXT,
      fileName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      uploadedAt TEXT NOT NULL,
      fileType TEXT NOT NULL
    )
  `);
}

function readMaterialsStore() {
  ensureMaterialsStore();
  const rows = materialsDb.prepare(`
    SELECT id, title, description, course, category, dueDate, professor, fileName, filePath, uploadedAt, fileType
    FROM materials
    ORDER BY uploadedAt DESC
  `).all();

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    course: row.course,
    category: row.category,
    dueDate: row.dueDate || '',
    professor: row.professor || 'Lecturer',
    fileName: row.fileName,
    filePath: row.filePath,
    uploadedAt: row.uploadedAt,
    fileType: row.fileType
  }));
}

function writeMaterialRecord(record) {
  ensureMaterialsStore();
  materialsDb.prepare(`
    INSERT INTO materials (id, title, description, course, category, dueDate, professor, fileName, filePath, uploadedAt, fileType)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.title,
    record.description,
    record.course,
    record.category,
    record.dueDate,
    record.professor,
    record.fileName,
    record.filePath,
    record.uploadedAt,
    record.fileType
  );
}

function deleteMaterialRecord(id) {
  ensureMaterialsStore();
  const existing = materialsDb.prepare('SELECT filePath FROM materials WHERE id = ?').get(id);
  if (!existing) {
    return { deleted: false, filePath: null };
  }

  if (existing.filePath && fs.existsSync(existing.filePath)) {
    try {
      fs.unlinkSync(existing.filePath);
    } catch (error) {
      console.warn('Could not remove material file:', error.message);
    }
  }

  const result = materialsDb.prepare('DELETE FROM materials WHERE id = ?').run(id);
  return { deleted: result.changes > 0, filePath: existing.filePath };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function getCurrentUserFromRequest(req) {
  const cookies = (req.headers.cookie || '')
    .split(';')
    .map((row) => row.trim())
    .filter(Boolean)
    .reduce((acc, row) => {
      const [key, ...value] = row.split('=');
      if (key) acc[key] = value.join('=');
      return acc;
    }, {});

  const sessionId = cookies.sid;
  if (!sessionId) return null;

  const authPort = process.env.AUTH_PORT || 3101;
  return new Promise((resolve) => {
    const targetOptions = {
      hostname: '127.0.0.1',
      port: authPort,
      path: '/api/me',
      method: 'GET',
      headers: { cookie: `sid=${sessionId}` }
    };

    const proxyReq = http.request(targetOptions, (proxyRes) => {
      let body = '';
      proxyRes.on('data', (chunk) => body += chunk);
      proxyRes.on('end', () => {
        if (proxyRes.statusCode === 200) {
          try {
            resolve(JSON.parse(body).user || null);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    proxyReq.on('error', () => resolve(null));
    proxyReq.end();
  });
}

function parseMultipartForm(req, contentType) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const boundaryMatch = contentType.match(/boundary=(.+)$/i);
        if (!boundaryMatch) {
          return reject(new Error('Missing multipart boundary'));
        }

        const boundary = boundaryMatch[1];
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const parts = [];
        let offset = 0;

        while (offset < buffer.length) {
          const start = buffer.indexOf(boundaryBuffer, offset);
          if (start === -1) break;
          const afterBoundary = start + boundaryBuffer.length;
          if (buffer.slice(afterBoundary, afterBoundary + 2).equals(Buffer.from('--'))) {
            break;
          }

          const next = buffer.indexOf(boundaryBuffer, afterBoundary);
          const partBuffer = next === -1 ? buffer.slice(afterBoundary) : buffer.slice(afterBoundary, next);
          const trimmed = partBuffer.length >= 2 && partBuffer.slice(-2).equals(Buffer.from('\r\n'))
            ? partBuffer.slice(0, -2)
            : partBuffer;
          parts.push(trimmed);
          offset = next === -1 ? buffer.length : next;
        }

        const payload = {};
        let file = null;

        parts.forEach((part) => {
          const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
          if (headerEnd === -1) return;

          const headerText = part.slice(0, headerEnd).toString('utf8');
          const bodyBuffer = part.slice(headerEnd + 4);
          const dispositionMatch = headerText.match(/name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
          if (!dispositionMatch) return;

          const [, fieldName, filename] = dispositionMatch;
          if (filename) {
            const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
            file = { fieldName, filename: safeName, data: bodyBuffer };
            return;
          }

          const value = bodyBuffer.toString('utf8').replace(/\r\n$/, '').trim();
          payload[fieldName] = value;
        });

        resolve({ payload, file });
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function buildMaterialRecord(payload, fileInfo) {
  const id = `material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeName = fileInfo ? path.basename(fileInfo.filename) : 'attachment';
  const storedFileName = fileInfo ? `${id}-${safeName}` : '';
  const storedPath = fileInfo ? path.join(materialsDir, storedFileName) : '';

  if (fileInfo) {
    fs.writeFileSync(storedPath, fileInfo.data);
  }

  return {
    id,
    title: payload.title || 'Untitled material',
    description: payload.description || '',
    course: payload.course || 'General',
    category: payload.category || 'lecture',
    dueDate: payload.dueDate || '',
    professor: payload.professor || 'Lecturer',
    fileName: safeName,
    filePath: fileInfo ? storedPath : '',
    uploadedAt: new Date().toISOString(),
    fileType: safeName.split('.').pop()?.toUpperCase() || 'FILE'
  };
}

function getDefaultCourses() {
  return [
    { name: 'Computer Science 101', code: 'CS101' },
    { name: 'Discrete Mathematics', code: 'MATH201' },
    { name: 'Software Engineering', code: 'SE301' },
    { name: 'Database Systems', code: 'DB402' }
  ];
}

function proxyRequest(targetPort, req, res) {
  const targetPath = `${req.url}`;
  const targetOptions = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers, host: '127.0.0.1' }
  };

  const proxyReq = http.request(targetOptions, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    sendJson(res, 502, { error: 'Upstream service unavailable.' });
  });

  req.pipe(proxyReq);
}

function resolveFilePath(requestedPath) {
  let safePath = requestedPath;
  if (safePath === '/') {
    safePath = '/Frontend-Splash/Splash.html';
  }

  const normalized = path.normalize(safePath).replace(/^\.(?:\/|\\|$)/, '');
  const candidates = [];

  if (normalized) {
    candidates.push(path.join(rootDir, normalized));
    candidates.push(path.join(rootDir, normalized.replace(/^\/+/, '')));
  }

  const directCandidate = candidates.find((candidate) => fs.existsSync(candidate));
  if (directCandidate) {
    return directCandidate;
  }

  const relativeSegments = normalized.split(path.sep).filter(Boolean);
  const fileName = relativeSegments[relativeSegments.length - 1];

  if (fileName) {
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return null;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const nested = walk(fullPath);
          if (nested) return nested;
        } else if (entry.name === fileName) {
          return fullPath;
        }
      }
      return null;
    };

    const found = walk(rootDir);
    if (found) return found;
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/api/signin') || url.pathname.startsWith('/api/signup') || url.pathname.startsWith('/api/guest') || url.pathname.startsWith('/api/me') || url.pathname.startsWith('/api/logout')) {
    return proxyRequest(authPort, req, res);
  }

  if (url.pathname.startsWith('/api/questions')) {
    return proxyRequest(forumPort, req, res);
  }

  if (url.pathname === '/api/upload' || url.pathname === '/api/chat') {
    return proxyRequest(studyPort, req, res);
  }

  if (url.pathname === '/api/materials/courses') {
    ensureMaterialsStore();
    const materials = readMaterialsStore();
    const courseMap = new Map();

    getDefaultCourses().forEach((course) => {
      courseMap.set(course.name, course);
    });

    materials.forEach((material) => {
      if (!courseMap.has(material.course)) {
        courseMap.set(material.course, {
          name: material.course,
          code: material.course.slice(0, 4).toUpperCase()
        });
      }
    });

    return sendJson(res, 200, { courses: Array.from(courseMap.values()) });
  }

  if (url.pathname === '/api/materials' && req.method === 'GET') {
    const materials = readMaterialsStore();
    return sendJson(res, 200, { materials });
  }

  if (url.pathname === '/api/materials' && req.method === 'POST') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return sendJson(res, 400, { error: 'Expected multipart form upload.' });
    }

    parseMultipartForm(req, contentType)
      .then(async ({ payload, file }) => {
        const currentUser = await getCurrentUserFromRequest(req);
        if (!currentUser || currentUser.role !== 'lecturer') {
          return sendJson(res, 403, { error: 'Only lecturers can upload materials.' });
        }

        if (!payload.title || !payload.course || !payload.description || !file) {
          return sendJson(res, 400, { error: 'Please provide a title, course, description, and file.' });
        }

        const record = buildMaterialRecord(payload, file);
        writeMaterialRecord(record);
        return sendJson(res, 200, { material: record });
      })
      .catch((error) => {
        sendJson(res, 400, { error: error.message || 'Upload failed.' });
      });
    return;
  }

  if (url.pathname.startsWith('/api/materials/')) {
    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'DELETE' && parts.length >= 2) {
      const id = parts[parts.length - 1];
      const currentUser = await getCurrentUserFromRequest(req);
      if (!currentUser || currentUser.role !== 'lecturer') {
        return sendJson(res, 403, { error: 'Only lecturers can delete materials.' });
      }

      const result = deleteMaterialRecord(id);
      if (!result.deleted) {
        return sendJson(res, 404, { error: 'Material not found.' });
      }

      return sendJson(res, 200, { success: true, id });
    }

    if (req.method === 'GET' && parts[parts.length - 1] === 'download' && parts.length >= 3) {
      const id = parts[parts.length - 2];
      const materials = readMaterialsStore();
      const material = materials.find((item) => item.id === id);
      if (!material || !material.filePath || !fs.existsSync(material.filePath)) {
        return sendJson(res, 404, { error: 'File not found.' });
      }

      const fileBuffer = fs.readFileSync(material.filePath);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(material.fileName)}"`
      });
      return res.end(fileBuffer);
    }
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(302, { Location: '/Frontend-Splash/Splash.html' });
    res.end();
    return;
  }

  const filePath = resolveFilePath(url.pathname);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mimeType });
  res.end(content);
});

server.listen(port, () => {
  console.log(`Unified MYRA server running on http://localhost:${port}`);
});
