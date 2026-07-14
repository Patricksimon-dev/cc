const test = require('node:test');
const assert = require('node:assert/strict');

test('vercel entrypoint exports a request handler', () => {
  const handler = require('../api');
  assert.equal(typeof handler, 'function');
});
