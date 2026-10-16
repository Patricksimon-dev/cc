import 'dotenv/config'

const usePostgres = Boolean(process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING)
const persistence = usePostgres
  ? await import('./postgresPersistence.js')
  : await import('./sqlitePersistence.js')

export const storageEngine = usePostgres ? 'postgres' : 'sqlite'
export const getDb = persistence.getDb
export const getUpload = persistence.getUpload
export const saveUpload = persistence.saveUpload
export const deleteUpload = persistence.deleteUpload

export async function initializePersistence() {
  if (persistence.initializePersistence) {
    await persistence.initializePersistence()
  }
}
