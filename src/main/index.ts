import { app, BrowserWindow, ipcMain, dialog, session } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import { fileURLToPath } from 'url'
import PDFDocument from 'pdfkit'
import { registerWhisperHandlers } from './native/whisper-bridge.js'
import { registerLLMHandlers } from './native/llm-bridge.js'
import { logger, log } from './logger.js'

// ES module __dirname polyfill
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ==========================================
// Security: IPC Channel Allowlist
// ==========================================
const ALLOWED_IPC_CHANNELS = new Set([
  'dialog:openPdf',
  'session:save',
  'session:load',
  'session:list',
  'session:delete',
  'audio:save',
  'audio:delete',
  'app:getPaths',
  'export:pdf',
  'export:generatePdf',
  'logs:get',
  'logs:getAll',
  'logs:clear',
  'logs:getPath',
  'logs:write',
  'whisper:init',
  'whisper:transcribe',
  'whisper:getInfo',
  'whisper:getModels',
  'whisper:setModel',
  'whisper:downloadModel',
  'whisper:deleteModel',
  'whisper:cancelDownload',
  'llm:init',
  'llm:generate',
  'llm:generateStream',
  'llm:getInfo',
  'llm:getModels',
  'llm:setModel',
  'llm:unload',
  'llm:downloadModel',
  'llm:deleteModel',
  'llm:cancelDownload',
])

// Valid log levels for renderer logging
const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error'])

// Export data structure for PDF generation
interface ExportData {
  sessionName: string
  exportedAt: string
  slides: Array<{
    index: number
    imageData: string | null
    note: string | null
    transcript: string | null
  }>
}

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged
// Allow forcing DevTools open via env var for debugging production builds
const openDevTools = isDev || process.env.OPEN_DEVTOOLS === 'true'

let mainWindow: BrowserWindow | null = null

// User data directory for storing sessions
const userDataPath = app.getPath('userData')
const sessionsPath = path.join(userDataPath, 'sessions')

// Ensure sessions directory exists
if (!fs.existsSync(sessionsPath)) {
  fs.mkdirSync(sessionsPath, { recursive: true })
}

/**
 * Sanitizes a session ID to prevent path traversal attacks.
 * Only allows alphanumeric characters, hyphens, and underscores.
 * Returns null if the ID is invalid.
 */
function sanitizeSessionId(sessionId: string): string | null {
  if (!sessionId || typeof sessionId !== 'string') {
    return null
  }

  // Only allow UUID-like patterns (alphanumeric + hyphens)
  const sanitized = sessionId.replace(/[^a-zA-Z0-9\-_]/g, '')

  // Must be at least 1 char and match what we cleaned
  if (sanitized.length === 0 || sanitized !== sessionId) {
    log.security('SESSION_ID_INVALID', { sessionId, action: 'rejected' })
    return null
  }

  // Additional check: ensure resolved path stays within sessions directory
  const resolvedPath = path.resolve(sessionsPath, sanitized)
  if (!resolvedPath.startsWith(sessionsPath)) {
    log.security('PATH_TRAVERSAL_BLOCKED', { sessionId, action: 'blocked' })
    return null
  }

  return sanitized
}

/**
 * Validates slide index to prevent injection.
 */
function sanitizeSlideIndex(slideIndex: number): number | null {
  if (typeof slideIndex !== 'number' || !Number.isInteger(slideIndex) || slideIndex < 0) {
    return null
  }
  return slideIndex
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#FDFBF7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true, // Security: Enable renderer sandbox
      webSecurity: true, // Security: Enforce same-origin policy
      allowRunningInsecureContent: false, // Security: Block mixed content
      preload: path.join(__dirname, '../preload.js'),
    },
  })

  // Security: Set strict CSP for production
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: blob:; " +
            "connect-src 'self'; " +
            "worker-src 'self' blob:; " +
            "frame-src 'none'; " +
            "object-src 'none'; " +
            "base-uri 'self';"
          ]
        }
      })
    })
  }

  // Security: Validate IPC channels
  mainWindow.webContents.on('ipc-message', (event, channel) => {
    if (!ALLOWED_IPC_CHANNELS.has(channel)) {
      log.security('IPC_CHANNEL_BLOCKED', { channel, action: 'blocked' })
      event.preventDefault()
    }
  })

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url)
    const allowedOrigins = ['localhost', '127.0.0.1']
    
    if (isDev && allowedOrigins.some(origin => parsedUrl.hostname === origin)) {
      return // Allow dev server navigation
    }
    
    if (parsedUrl.protocol === 'file:') {
      return // Allow local file navigation in production
    }
    
    log.security('EXTERNAL_NAVIGATION_BLOCKED', { url, action: 'blocked' })
    event.preventDefault()
  })

  // Security: Block new window creation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    log.security('NEW_WINDOW_BLOCKED', { url, action: 'blocked' })
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Open DevTools in dev mode or when explicitly requested
  if (openDevTools) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Register native handlers
  registerWhisperHandlers()
  registerLLMHandlers()

  // Create window
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC Handlers

// File dialog for PDF selection
ipcMain.handle('dialog:openPdf', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const filePath = result.filePaths[0]
  const fileBuffer = await fsPromises.readFile(filePath)
  const fileName = path.basename(filePath)

  return {
    fileName,
    filePath,
    data: fileBuffer.toString('base64'),
  }
})

// Save session data
ipcMain.handle('session:save', async (_event, sessionId: string, data: string) => {
  const safeSessionId = sanitizeSessionId(sessionId)
  if (!safeSessionId) {
    throw new Error('Invalid session ID')
  }

  const sessionDir = path.join(sessionsPath, safeSessionId)
  await fsPromises.mkdir(sessionDir, { recursive: true })

  const sessionFile = path.join(sessionDir, 'session.json')
  await fsPromises.writeFile(sessionFile, data, 'utf-8')
  return true
})

// Load session data
ipcMain.handle('session:load', async (_event, sessionId: string) => {
  const safeSessionId = sanitizeSessionId(sessionId)
  if (!safeSessionId) {
    throw new Error('Invalid session ID')
  }

  const sessionFile = path.join(sessionsPath, safeSessionId, 'session.json')
  try {
    return await fsPromises.readFile(sessionFile, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw err
  }
})

// List all sessions
ipcMain.handle('session:list', async () => {
  try {
    await fsPromises.access(sessionsPath)
  } catch {
    return []
  }

  const dirs = await fsPromises.readdir(sessionsPath)
  const sessions: Array<{
    id: string
    name: string
    createdAt: string
    updatedAt: string
    slideCount: number
  }> = []

  for (const dir of dirs) {
    // Validate directory name to prevent issues
    if (!sanitizeSessionId(dir)) continue

    const sessionFile = path.join(sessionsPath, dir, 'session.json')
    try {
      const content = await fsPromises.readFile(sessionFile, 'utf-8')
      const data = JSON.parse(content)
      sessions.push({
        id: dir,
        name: data.name || 'Untitled Session',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        slideCount: data.slides?.length || 0,
      })
    } catch {
      // Skip invalid session files
      continue
    }
  }

  return sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
})

// Delete session
ipcMain.handle('session:delete', async (_event, sessionId: string) => {
  const safeSessionId = sanitizeSessionId(sessionId)
  if (!safeSessionId) {
    throw new Error('Invalid session ID')
  }

  const sessionDir = path.join(sessionsPath, safeSessionId)
  try {
    await fsPromises.rm(sessionDir, { recursive: true })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
  }
  return true
})

// Save audio file
ipcMain.handle(
  'audio:save',
  async (_event, sessionId: string, audioData: string, slideIndex: number) => {
    const safeSessionId = sanitizeSessionId(sessionId)
    if (!safeSessionId) {
      throw new Error('Invalid session ID')
    }

    const safeSlideIndex = sanitizeSlideIndex(slideIndex)
    if (safeSlideIndex === null) {
      throw new Error('Invalid slide index')
    }

    const sessionDir = path.join(sessionsPath, safeSessionId)
    await fsPromises.mkdir(sessionDir, { recursive: true })

    const audioDir = path.join(sessionDir, 'audio')
    await fsPromises.mkdir(audioDir, { recursive: true })

    const audioFile = path.join(audioDir, `slide-${safeSlideIndex}.webm`)
    const buffer = Buffer.from(audioData, 'base64')
    await fsPromises.writeFile(audioFile, buffer)

    return audioFile
  }
)

// Delete audio file
ipcMain.handle(
  'audio:delete',
  async (_event, sessionId: string, slideIndex: number) => {
    const safeSessionId = sanitizeSessionId(sessionId)
    if (!safeSessionId) {
      throw new Error('Invalid session ID')
    }

    const safeSlideIndex = sanitizeSlideIndex(slideIndex)
    if (safeSlideIndex === null) {
      throw new Error('Invalid slide index')
    }

    const audioFile = path.join(sessionsPath, safeSessionId, 'audio', `slide-${safeSlideIndex}.webm`)
    try {
      await fsPromises.unlink(audioFile)
      return true
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return true // File doesn't exist, consider it deleted
      }
      throw err
    }
  }
)

// Get app paths
ipcMain.handle('app:getPaths', async () => {
  return {
    userData: userDataPath,
    sessions: sessionsPath,
  }
})

// Export session to PDF
ipcMain.handle('export:pdf', async (_event, sessionId: string) => {
  const safeSessionId = sanitizeSessionId(sessionId)
  if (!safeSessionId) {
    throw new Error('Invalid session ID')
  }

  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: `lecture-notes-${safeSessionId}.pdf`,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  })

  if (result.canceled || !result.filePath) {
    return null
  }

  return result.filePath
})

/**
 * Validates that a file path is safe for export operations.
 * Must be in user-accessible directories (Desktop, Documents, Downloads).
 */
function validateExportPath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') {
    return false
  }

  // Normalize and resolve the path
  const normalizedPath = path.resolve(filePath)
  
  // Get allowed export directories
  const allowedDirs = [
    app.getPath('desktop'),
    app.getPath('documents'),
    app.getPath('downloads'),
    app.getPath('home'), // Allow anywhere in home directory
  ]

  // Check if path is within allowed directories
  const isAllowed = allowedDirs.some(dir => normalizedPath.startsWith(dir))
  
  if (!isAllowed) {
    log.security('EXPORT_PATH_BLOCKED', { 
      filePath: normalizedPath, 
      action: 'blocked',
      reason: 'outside_allowed_directories'
    })
    return false
  }

  // Ensure it's a PDF file
  if (!normalizedPath.toLowerCase().endsWith('.pdf')) {
    log.security('EXPORT_PATH_BLOCKED', { 
      filePath: normalizedPath, 
      action: 'blocked',
      reason: 'invalid_extension'
    })
    return false
  }

  return true
}

// Generate PDF from export data
ipcMain.handle(
  'export:generatePdf',
  async (_event, filePath: string, exportData: ExportData) => {
    // Security: Validate export path
    if (!validateExportPath(filePath)) {
      throw new Error('Invalid export path')
    }

    return new Promise<boolean>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        })

        const writeStream = fs.createWriteStream(filePath)
        doc.pipe(writeStream)

        // Title page
        doc
          .fontSize(24)
          .font('Helvetica-Bold')
          .text(exportData.sessionName, { align: 'center' })

        doc.moveDown()

        doc
          .fontSize(12)
          .font('Helvetica')
          .fillColor('#666666')
          .text(`Exported: ${new Date(exportData.exportedAt).toLocaleString()}`, {
            align: 'center',
          })
          .text(`${exportData.slides.length} slides`, { align: 'center' })

        doc.fillColor('#000000')

        // Process each slide
        for (const slide of exportData.slides) {
          doc.addPage()

          // Slide header
          doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .text(`Slide ${slide.index}`, { underline: true })

          doc.moveDown()

          // Add slide image if available
          if (slide.imageData) {
            try {
              const imageBuffer = Buffer.from(slide.imageData, 'base64')
              const pageWidth = doc.page.width - 100 // Account for margins
              doc.image(imageBuffer, {
                fit: [pageWidth, 300],
                align: 'center',
              })
              doc.moveDown()
            } catch (imgError) {
              log.error(`Failed to add image for slide ${slide.index}`, imgError, 'export')
              doc
                .fontSize(10)
                .fillColor('#999999')
                .text('[Image could not be loaded]')
                .fillColor('#000000')
              doc.moveDown()
            }
          }

          // Add notes if available
          if (slide.note) {
            doc
              .fontSize(12)
              .font('Helvetica-Bold')
              .text('Notes:')
              .font('Helvetica')
              .fontSize(11)
              .text(slide.note, { lineGap: 2 })
            doc.moveDown()
          }

          // Add transcript if available
          if (slide.transcript) {
            doc
              .fontSize(12)
              .font('Helvetica-Bold')
              .text('Transcript:')
              .font('Helvetica')
              .fontSize(10)
              .fillColor('#444444')
              .text(slide.transcript, { lineGap: 2 })
              .fillColor('#000000')
          }
        }

        // Finalize PDF
        doc.end()

        writeStream.on('finish', () => {
          resolve(true)
        })

        writeStream.on('error', err => {
          reject(err)
        })
      } catch (error) {
        reject(error)
      }
    })
  }
)

// ==========================================
// Logging IPC Handlers
// ==========================================

// Get log content
ipcMain.handle('logs:get', async () => {
  return await logger.getLogContent()
})

// Get all logs including rotated
ipcMain.handle('logs:getAll', async () => {
  return await logger.getAllLogs()
})

// Clear logs
ipcMain.handle('logs:clear', async () => {
  await logger.clearLogs()
  return true
})

// Get logs directory path
ipcMain.handle('logs:getPath', async () => {
  return logger.getLogPath()
})

// Log from renderer process
ipcMain.handle('logs:write', async (_event, level: string, message: string, data?: unknown) => {
  // Security: Validate log level
  if (!VALID_LOG_LEVELS.has(level)) {
    log.security('INVALID_LOG_LEVEL', { providedLevel: level, action: 'sanitized' })
    level = 'info'
  }

  // Security: Sanitize message length to prevent log flooding
  const maxMessageLength = 10000
  const sanitizedMessage = typeof message === 'string' 
    ? message.slice(0, maxMessageLength) 
    : String(message).slice(0, maxMessageLength)

  switch (level) {
    case 'debug':
      log.debug(sanitizedMessage, data, 'renderer')
      break
    case 'info':
      log.info(sanitizedMessage, data, 'renderer')
      break
    case 'warn':
      log.warn(sanitizedMessage, data, 'renderer')
      break
    case 'error':
      log.error(sanitizedMessage, data, 'renderer')
      break
    default:
      log.info(sanitizedMessage, data, 'renderer')
  }
  return true
})
