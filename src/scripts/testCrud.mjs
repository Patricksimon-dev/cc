import assert from 'assert';

const BASE = 'http://localhost:3001';

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  return { status: res.status, body };
}

async function run() {
  console.log('Logging in as admin...');
  let r = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@gracechurch.org', password: 'admin123' }),
  });
  console.log('LOGIN', r.status, JSON.stringify(r.body));
  if (r.status !== 200 || !r.body.token) {
    console.error('Login failed'); process.exit(2);
  }
  const token = r.body.token;

  // Create announcement
  console.log('Creating announcement...');
  r = await request('/api/admin/announcements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: 'E2E Test Announcement', body: 'Test body', date: new Date().toISOString() }),
  });
  console.log('CREATE', r.status, JSON.stringify(r.body));
  if (r.status !== 201 || !r.body.item || !r.body.item.id) { console.error('Create failed'); process.exit(3); }
  const id = r.body.item.id;

  // Verify appears in public content
  console.log('Verifying public content includes new announcement...');
  r = await request('/api/content');
  console.log('CONTENT', r.status);
  if (r.status !== 200) { console.error('Failed to fetch content'); process.exit(4); }
  const found = (r.body.announcements || []).find((a) => a.id === id);
  if (!found) { console.error('Announcement not found in public content'); process.exit(5); }

  // Update announcement
  console.log('Updating announcement title...');
  r = await request(`/api/admin/announcements/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: 'E2E Updated Title' }),
  });
  console.log('UPDATE', r.status, JSON.stringify(r.body));
  if (r.status !== 200 || r.body.item.title !== 'E2E Updated Title') { console.error('Update failed'); process.exit(6); }

  // Delete announcement
  console.log('Deleting announcement...');
  r = await request(`/api/admin/announcements/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('DELETE', r.status);
  if (r.status !== 204) { console.error('Delete failed'); process.exit(7); }

  // Confirm removal
  r = await request('/api/content');
  const still = (r.body.announcements || []).find((a) => a.id === id);
  if (still) { console.error('Announcement still present after delete'); process.exit(8); }

  console.log('E2E CRUD tests passed');
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
