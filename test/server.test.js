const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

process.env.DB_PATH = path.join(__dirname, '..', 'data', 'test.json');
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_EMAIL = 'simonogar025@gmail.com';
process.env.ADMIN_PASSWORD = 'christchosen123@kl';

const { startServer, normalizePlatforms, publishToSocialPlatforms } = require('../server');

let server;
let baseUrl;

test.before(async () => {
  if (fs.existsSync(process.env.DB_PATH)) {
    fs.unlinkSync(process.env.DB_PATH);
  }

  const started = await startServer(0);
  server = started.server;
  baseUrl = `http://127.0.0.1:${started.port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('admin login returns a JWT token', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'simonogar025@gmail.com',
      password: 'christchosen123@kl',
    }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.token);
  assert.equal(data.admin.email, process.env.ADMIN_EMAIL);
});

test('announcements can be created by an authenticated admin', async () => {
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'simonogar025@gmail.com',
      password: 'christchosen123@kl',
    }),
  });

  const { token } = await loginResponse.json();

  const response = await fetch(`${baseUrl}/api/announcements`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Prayer Night',
      message: 'Join us this Friday for prayer.',
      audience: 'Church family',
      platforms: ['website', 'facebook'],
      publishNow: false,
    }),
  });

  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.title, 'Prayer Night');
  assert.equal(created.status, 'draft');
});

test('platform normalization and social posting helpers work', async () => {
  assert.deepEqual(normalizePlatforms(undefined), ['website']);
  assert.deepEqual(normalizePlatforms('facebook,instagram'), ['facebook', 'instagram']);

  process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'fb-token';
  process.env.FACEBOOK_PAGE_ID = 'page-1';
  process.env.TWITTER_BEARER_TOKEN = 'tw-token';

  const calls = [];
  const results = await publishToSocialPlatforms(
    {
      title: 'Test post',
      message: 'Hello',
      platforms: ['facebook', 'twitter'],
    },
    null,
    async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ id: '1' }) };
    },
  );

  assert.equal(results.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(results[0].status, 'posted');
});
