import bcrypt from 'bcryptjs';
import { initializeContentStore, getPublicContent, findAdminByEmail } from './src/services/contentService.js';

try {
  await initializeContentStore();
  const admin = await findAdminByEmail('admin');
  const content = await getPublicContent();
  const leader = content.leadership[0] || null;
  const ok = Boolean(
    admin &&
    admin.email &&
    bcrypt.compareSync('admin123', admin.password_hash) &&
    content.leadership.length === 1 &&
    leader &&
    leader.name === 'Pastor : Ekele Idoko Mark . The G . O of the CCAM' &&
    leader.imageUrl === '/go-pastor.jpg'
  );

  console.log(JSON.stringify({
    ok,
    adminEmail: admin?.email ?? null,
    passwordMatches: admin ? bcrypt.compareSync('admin123', admin.password_hash) : false,
    leadershipCount: content.leadership.length,
    leader,
  }, null, 2));

  process.exit(ok ? 0 : 1);
} catch (error) {
  console.error(error);
  process.exit(1);
}
