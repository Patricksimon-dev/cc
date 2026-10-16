export function errorHandler(err, req, res, next) {
  console.error(err)
  const isStorageError = /quota|space|storage|disk|ENOSPC/i.test(err.message || '')
  const status = err.status || (isStorageError ? 507 : 500)
  res.status(status).json({
    error: isStorageError
      ? 'Persistent database storage is full. Remove old uploads or increase the database storage, then try again.'
      : err.message || 'Internal server error',
  })
}
