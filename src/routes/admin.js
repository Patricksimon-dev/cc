import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import { config } from '../config.js'
import { deleteUploadByUrl, getUploadBucket } from '../db/contentPersistence.js'
import {
  contentRepositories,
  updateAboutPage,
  deleteAboutPage,
  getItemByType,
} from '../services/contentService.js'
import { publishToSocial } from '../services/socialPublisher.js'

const router = Router()
const COLLECTIONS = Object.keys(contentRepositories)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

function stripMeta(body) {
  const { shareToSocial, platforms, customMessage, ...rest } = body
  return { rest, shareToSocial, platforms, customMessage }
}

async function maybeShare(contentType, item, meta) {
  if (!meta.shareToSocial || !meta.platforms?.length) return []
  return publishToSocial({
    contentType,
    contentId: item.id,
    item,
    platforms: meta.platforms,
    customMessage: meta.customMessage,
  })
}

router.use(requireAuth)

router.post('/upload', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }
  try {
    const bucket = getUploadBucket()
    const fileId = bucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
    })
    fileId.end(req.file.buffer)
    fileId.on('finish', () => {
      deleteUploadByUrl(req.body.previousUrl)
        .then(() => res.json({ url: `${config.apiPublicUrl}/api/uploads/${fileId.id}` }))
        .catch(next)
    })
    fileId.on('error', next)
  } catch (err) {
    next(err)
  }
})

router.put('/about', async (req, res, next) => {
  try {
    const about = await updateAboutPage(req.body)
    res.json(about)
  } catch (err) {
    next(err)
  }
})

router.delete('/about', async (req, res, next) => {
  try {
    await deleteAboutPage()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

for (const type of COLLECTIONS) {
  const repo = contentRepositories[type]

  router.get(`/${type}`, (req, res) => {
    res.json(repo.list())
  })

  router.post(`/${type}`, async (req, res, next) => {
    try {
      const { rest, shareToSocial, platforms, customMessage } = stripMeta(req.body)
      const id = uuidv4()
      const item = await repo.create(id, rest)
      const socialResults = await maybeShare(type, item, {
        shareToSocial,
        platforms,
        customMessage,
      })
      res.status(201).json({ item, socialResults })
    } catch (err) {
      next(err)
    }
  })

  router.put(`/${type}/:id`, async (req, res, next) => {
    try {
      const existing = getItemByType(type, req.params.id)
      if (!existing) return res.status(404).json({ error: 'Not found' })
      const { rest, shareToSocial, platforms, customMessage } = stripMeta(req.body)
      const item = await repo.update(req.params.id, rest)
      const socialResults = await maybeShare(type, item, {
        shareToSocial,
        platforms,
        customMessage,
      })
      res.json({ item, socialResults })
    } catch (err) {
      next(err)
    }
  })

  router.delete(`/${type}/:id`, async (req, res, next) => {
    const existing = getItemByType(type, req.params.id)
    if (!existing) return res.status(404).json({ error: 'Not found' })
    try {
      if (type === 'leadership') {
        await deleteUploadByUrl(existing.imageUrl)
      }
      await repo.remove(req.params.id)
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  })
}

export default router
