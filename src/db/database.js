import 'dotenv/config'

export const storageEngine = (process.env.STORAGE_ENGINE || 'sqlite').toLowerCase()
if (!['sqlite', 'postgres'].includes(storageEngine)) {
  throw new Error('STORAGE_ENGINE must be either "sqlite" or "postgres"')
}

const persistence = storageEngine === 'postgres'
  ? await import('./postgresPersistence.js')
  : await import('./sqlitePersistence.js')

export const getDb = persistence.getDb
export const getUpload = persistence.getUpload
export const saveUpload = persistence.saveUpload
export const deleteUpload = persistence.deleteUpload

export async function initializePersistence() {
  if (persistence.initializePersistence) {
    await persistence.initializePersistence()
  }
}
