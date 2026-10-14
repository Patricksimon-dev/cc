// For Neon/Postgres-only setup we forward sqlitePersistence exports to
// `postgresPersistence.js`. This keeps existing import paths intact while
// moving all persistence to Postgres.
import {
  getDb as pgGetDb,
  saveUpload as pgSaveUpload,
  getUpload as pgGetUpload,
  deleteUpload as pgDeleteUpload,
} from './postgresPersistence.js';

export const getDb = pgGetDb;
export const saveUpload = pgSaveUpload;
export const getUpload = pgGetUpload;
export const deleteUpload = pgDeleteUpload;
