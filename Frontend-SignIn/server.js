const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { DatabaseSync } = require('node:sqlite');

const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'Frontend-SignIn', 'users.db');
const usePostgres = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
const sqliteDb = usePostgres ? null : new DatabaseSync(dbPath);
const postgresPool = usePostgres
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    })
  : null;
const sessions = new Map();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey) {
      acc[rawKey] = rawValue.join('=');
    }
    return acc;
  }, {});
}

function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionId = cookies.sid;
  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return session.user;
}

function setSessionCookie(res, sessionId) {
  res.setHeader('Set-Cookie', `sid=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

async function ensureUserSchema() {
  if (usePostgres) {
    await postgresPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        programme TEXT,
        level TEXT,
        index_number TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    return;
  }

  const tableExists = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!tableExists) {
    sqliteDb.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        programme TEXT,
        level TEXT,
        index_number TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    return;
  }

  const columns = sqliteDb.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
  if (!columns.includes('programme')) {
    sqliteDb.exec('ALTER TABLE users ADD COLUMN programme TEXT');
  }
  if (!columns.includes('level')) {
    sqliteDb.exec('ALTER TABLE users ADD COLUMN level TEXT');
  }
  if (!columns.includes('index_number')) {
    sqliteDb.exec('ALTER TABLE users ADD COLUMN index_number TEXT');
  }
}

async function findUserByEmail(email) {
  if (usePostgres) {
    const result = await postgresPool.query(
      'SELECT id, full_name, email, role, password, programme, level, index_number FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  return sqliteDb.prepare('SELECT id, full_name, email, role, password, programme, level, index_number FROM users WHERE email = ?').get(email);
}

async function createUser(fullName, email, hashedPassword, role, programme, level, indexNumber) {
  if (usePostgres) {
    await postgresPool.query(
      'INSERT INTO users (full_name, email, password, role, programme, level, index_number) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [fullName, email, hashedPassword, role, programme || null, level || null, indexNumber || null]
    );
    return;
  }

  const statement = sqliteDb.prepare('INSERT INTO users (full_name, email, password, role, programme, level, index_number) VALUES (?, ?, ?, ?, ?, ?, ?)');
  statement.run(fullName, email, hashedPassword, role, programme || null, level || null, indexNumber || null);
}

ensureUserSchema();

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

function readFileSafe(filePath) {
  return fs.readFileSync(filePath);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && url.pathname === '/api/signup') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const fullName = String(data.fullName || '').trim();
        const email = String(data.email || '').trim().toLowerCase();
        const password = String(data.password || '').trim();
        const role = String(data.role || 'student').trim().toLowerCase();
        const programme = role === 'student' ? String(data.programme || '').trim() : null;
        const level = role === 'student' ? String(data.level || '').trim() : null;
        const indexNumber = role === 'student' ? String(data.indexNumber || '').trim() : null;

        if (!fullName || !email || !password || !['student', 'lecturer'].includes(role)) {
          return sendJson(res, 400, { error: 'Please provide a valid name, email, password, and role.' });
        }

        const existingUser = await findUserByEmail(email);
        if (existingUser) {
          return sendJson(res, 409, { error: 'An account with this email already exists.' });
        }

        await createUser(fullName, email, hashPassword(password), role, programme, level, indexNumber);
        return sendJson(res, 201, { success: true, role, fullName });
      } catch (error) {
        if (String(error.message).includes('UNIQUE')) {
          return sendJson(res, 409, { error: 'An account with this email already exists.' });
        }
        return sendJson(res, 500, { error: 'Could not create account.' });
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/signin') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const email = String(data.email || '').trim().toLowerCase();
        const password = String(data.password || '').trim();
        const role = String(data.role || '').trim().toLowerCase();

        if (!email || !password) {
          return sendJson(res, 400, { error: 'Please provide your email and password.' });
        }

        const row = await findUserByEmail(email);
        if (!row) {
          return sendJson(res, 401, { error: 'Invalid email or password.' });
        }

        const passwordMatches = row.password === hashPassword(password) || row.password === password;
        if (!passwordMatches) {
          return sendJson(res, 401, { error: 'Invalid email or password.' });
        }

        if (role && row.role !== role) {
          return sendJson(res, 401, { error: 'This account is not registered for that role.' });
        }

        const sessionId = crypto.randomBytes(16).toString('hex');
        const user = {
          id: row.id,
          fullName: row.full_name,
          email: row.email,
          role: row.role,
          programme: row.programme || '',
          level: row.level || '',
          indexNumber: row.index_number || ''
        };
        sessions.set(sessionId, { user, expiresAt: Date.now() + 1000 * 60 * 60 * 8 });
        setSessionCookie(res, sessionId);
        return sendJson(res, 200, { success: true, user });
      } catch (error) {
        return sendJson(res, 500, { error: 'Unable to sign in right now.' });
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/guest') {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const guestUser = { id: null, fullName: 'Guest', email: 'guest@myra.local', role: 'guest' };
    sessions.set(sessionId, { user: guestUser, expiresAt: Date.now() + 1000 * 60 * 60 * 8 });
    setSessionCookie(res, sessionId);
    return sendJson(res, 200, { success: true, user: guestUser });
  }

  if (req.method === 'GET' && url.pathname === '/api/me') {
    const user = getSessionUser(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Not signed in.' });
    }
    return sendJson(res, 200, { user });
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const cookies = parseCookies(req.headers.cookie || '');
    if (cookies.sid) {
      sessions.delete(cookies.sid);
    }
    clearSessionCookie(res);
    return sendJson(res, 200, { success: true });
  }

  let requestedPath = url.pathname;
  if (requestedPath === '/') {
    requestedPath = '/Frontend-Splash/Splash.html';
  }

  const safePath = path.normalize(requestedPath).replace(/^\.(?:\/|$)/, '');
  const filePath = path.join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403); res.end('Forbidden');
    return;
  }

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    const content = readFileSafe(filePath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`MYRA auth server running on http://localhost:${port}`);
});
