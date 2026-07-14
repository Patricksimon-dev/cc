const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const host = process.env.HOST || '0.0.0.0';
const jwtSecret = process.env.JWT_SECRET || 'church-secret';
const adminEmail = process.env.ADMIN_EMAIL || 'simonogar025@gmail.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'christchosen123@kl';

function resolveStoragePaths() {
  const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const tempRoot = path.join(os.tmpdir(), 'ccam');
  const tempDbPath = path.join(tempRoot, 'data', 'app.json');
  const tempUploadsDir = path.join(tempRoot, 'uploads');

  if (process.env.DB_PATH) {
    return { dbPath: process.env.DB_PATH, uploadsDir: process.env.UPLOADS_DIR || tempUploadsDir };
  }

  if (isServerless) {
    return { dbPath: tempDbPath, uploadsDir: tempUploadsDir };
  }

  return {
    dbPath: path.join(__dirname, 'data', 'app.json'),
    uploadsDir: path.join(__dirname, 'uploads'),
  };
}

const { dbPath, uploadsDir } = resolveStoragePaths();
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      cb(null, safeName);
    },
  }),
});

function normalizePlatforms(platforms) {
  if (Array.isArray(platforms)) {
    return platforms
      .map((platform) => `${platform}`.trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof platforms === 'string') {
    const parsed = platforms
      .split(',')
      .map((platform) => platform.trim().toLowerCase())
      .filter(Boolean);
    return parsed.length ? parsed : ['website'];
  }

  return ['website'];
}

async function publishToSocialPlatforms(announcement, req, fetchImpl = fetch) {
  const platforms = normalizePlatforms(announcement.platforms);
  const results = [];

  for (const platform of platforms) {
    if (platform === 'website') {
      results.push({ platform, status: 'posted', note: 'Stored on website' });
      continue;
    }

    if (platform === 'facebook') {
      const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      const pageId = process.env.FACEBOOK_PAGE_ID;
      if (!token || !pageId) {
        results.push({ platform, status: 'skipped', note: 'Missing Facebook credentials' });
        continue;
      }

      const response = await fetchImpl(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: `${announcement.title}\n\n${announcement.message}`,
          access_token: token,
        }),
      });
      results.push({ platform, status: response.ok ? 'posted' : 'failed', note: response.ok ? 'Facebook post sent' : 'Facebook post failed' });
      continue;
    }

    if (platform === 'instagram') {
      const token = process.env.INSTAGRAM_ACCESS_TOKEN;
      const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
      if (!token || !businessAccountId) {
        results.push({ platform, status: 'skipped', note: 'Missing Instagram credentials' });
        continue;
      }

      const response = await fetchImpl(`https://graph.facebook.com/v19.0/${businessAccountId}/media`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          image_url: announcement.media_url || '',
          caption: `${announcement.title}\n${announcement.message}`,
          access_token: token,
        }),
      });
      results.push({ platform, status: response.ok ? 'posted' : 'failed', note: response.ok ? 'Instagram post sent' : 'Instagram post failed' });
      continue;
    }

    if (platform === 'twitter') {
      const token = process.env.TWITTER_BEARER_TOKEN;
      if (!token) {
        results.push({ platform, status: 'skipped', note: 'Missing Twitter credentials' });
        continue;
      }

      const response = await fetchImpl('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text: `${announcement.title}\n${announcement.message}` }),
      });
      results.push({ platform, status: response.ok ? 'posted' : 'failed', note: response.ok ? 'Twitter post sent' : 'Twitter post failed' });
      continue;
    }

    results.push({ platform, status: 'skipped', note: 'Unsupported platform' });
  }

  return results;
}

function readStore() {
  if (!fs.existsSync(dbPath)) {
    return { admins: [], announcements: [] };
  }

  const raw = fs.readFileSync(dbPath, 'utf8');
  return raw ? JSON.parse(raw) : { admins: [], announcements: [] };
}

function writeStore(store) {
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2));
}

function initDb() {
  const store = readStore();

  if (!store.admins || !store.admins.length) {
    store.admins = [{
      id: 1,
      email: adminEmail,
      password_hash: bcrypt.hashSync(adminPassword, 10),
      created_at: new Date().toISOString(),
    }];
    writeStore(store);
    return store;
  }

  // Ensure the primary admin record matches the environment variables.
  const primary = store.admins[0];
  const passwordMatches = primary.password_hash && bcrypt.compareSync(adminPassword, primary.password_hash);
  if (primary.email !== adminEmail || !passwordMatches) {
    primary.email = adminEmail;
    primary.password_hash = bcrypt.hashSync(adminPassword, 10);
    writeStore(store);
  }

  return store;
}

const store = initDb();

app.use(cors());
app.options('*', cors());
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.admin = decoded;
    return next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.html', (_req, res) => {
  res.redirect(301, '/admin');
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const currentStore = readStore();
  const admin = currentStore.admins.find((item) => item.email === email);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = bcrypt.compareSync(password, admin.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: admin.id, email: admin.email }, jwtSecret, { expiresIn: '8h' });
  return res.json({ token, admin: { id: admin.id, email: admin.email } });
});

// Reset admin credentials (requires current admin token)
app.post('/api/auth/reset', authenticateToken, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const currentStore = readStore();
  const primary = currentStore.admins && currentStore.admins[0];
  if (!primary) {
    return res.status(500).json({ error: 'No admin record found' });
  }

  primary.email = email;
  primary.password_hash = bcrypt.hashSync(password, 10);
  writeStore(currentStore);

  return res.json({ ok: true, admin: { id: primary.id, email: primary.email } });
});

// Reset admin credentials using an admin reset secret
app.post('/api/auth/reset-secret', (req, res) => {
  const { email, password, secret } = req.body;
  const resetSecret = process.env.ADMIN_RESET_SECRET || '';

  if (!resetSecret) {
    return res.status(403).json({ error: 'Reset by secret is not enabled' });
  }

  if (!secret || secret !== resetSecret) {
    return res.status(401).json({ error: 'Invalid reset secret' });
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const currentStore = readStore();
  if (!currentStore.admins || !currentStore.admins.length) {
    currentStore.admins = [{ id: 1, email, password_hash: bcrypt.hashSync(password, 10), created_at: new Date().toISOString() }];
  } else {
    currentStore.admins[0].email = email;
    currentStore.admins[0].password_hash = bcrypt.hashSync(password, 10);
  }
  writeStore(currentStore);

  return res.json({ ok: true, admin: { id: currentStore.admins[0].id, email: currentStore.admins[0].email } });
});

app.get('/api/announcements', (_req, res) => {
  const currentStore = readStore();
  const announcements = [...currentStore.announcements].sort((a, b) => b.id - a.id);
  return res.json(announcements);
});

app.post('/api/announcements', authenticateToken, upload.single('mediaFile'), async (req, res) => {
  const { title, message, audience, platforms, mediaType, publishNow } = req.body;
  const file = req.file;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required.' });
  }

  const currentStore = readStore();
  const normalizedPlatforms = normalizePlatforms(platforms);
  const status = publishNow ? 'published' : 'draft';
  const announcement = {
    media_url: file ? `/uploads/${file.filename}` : '',
    media_name: file ? file.originalname : '',
    id: Date.now(),
    title,
    message,
    audience: audience || 'Church family',
    platforms: normalizedPlatforms,
    media_type: mediaType || 'text',
    status,
    publish_now: !!publishNow,
    created_at: new Date().toISOString(),
  };

  const publishResults = await publishToSocialPlatforms(announcement, req);
  announcement.social_publish_results = publishResults;

  currentStore.announcements.unshift(announcement);
  writeStore(currentStore);
  return res.status(201).json(announcement);
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  return next(err);
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  return next(err);
});

function startServer(portNumber = port) {
  initDb();
  return new Promise((resolve) => {
    const server = app.listen(portNumber, host, () => {
      resolve({ server, port: server.address().port });
    });
  });
}

if (require.main === module) {
  startServer().then(({ port: listenPort }) => {
    console.log(`Server listening on port ${listenPort}`);
  });
}

module.exports = { app, startServer, normalizePlatforms, publishToSocialPlatforms, resolveStoragePaths };
