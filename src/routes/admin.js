import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { requireAuth } from '../middleware/auth.js'
import {
  contentRepositories,
  updateAboutPage,
  getItemByType,
} from '../services/contentService.js'
import { publishToSocial } from '../services/socialPublisher.js'

const router = Router()
const COLLECTIONS = Object.keys(contentRepositories)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'))
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
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

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }
  const fileUrl = `/api/uploads/${req.file.filename}`
  res.json({ url: fileUrl })
})

router.put('/about', (req, res) => {
  const about = updateAboutPage(req.body)
  res.json(about)
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
      const item = repo.create(id, rest)
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
      const item = repo.update(req.params.id, rest)
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

  router.delete(`/${type}/:id`, (req, res) => {
    const existing = getItemByType(type, req.params.id)
    if (!existing) return res.status(404).json({ error: 'Not found' })
    repo.remove(req.params.id)
    res.status(204).send()
  })
}

export default router
