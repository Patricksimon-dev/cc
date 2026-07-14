const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');

test('vercel entrypoint exports a request handler', () => {
  const handler = require('../api');
  assert.equal(typeof handler, 'function');
});

test('storage paths fall back to a writable temp location', () => {
  process.env.VERCEL = '1';
  const { resolveStoragePaths } = require('../server');
  const paths = resolveStoragePaths();

  assert.equal(paths.dbPath, `${os.tmpdir()}/ccam/data/app.json`);
  assert.equal(paths.uploadsDir, `${os.tmpdir()}/ccam/uploads`);
});
