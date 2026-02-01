/**
 * Security utilities for the Electron main process
 * Provides validation, sanitization, and audit logging
 */

import * as path from 'path'
import * as crypto from 'crypto'
import { app } from 'electron'
import { log } from './logger.js'

// ============================================
// IPC Channel Allowlist
// ============================================

/**
 * Allowlist of valid IPC channels
 * Any channel not in this list should be rejected
 */
export const IPC_CHANNEL_ALLOWLIST = new Set([
  // Dialog
  'dialog:openPdf',
  // Session management
  'session:save',
  'session:load',
  'session:list',
  'session:delete',
  // Audio
  'audio:save',
  'audio:delete',
  // App paths
  'app:getPaths',
  // Export
  'export:pdf',
  'export:generatePdf',
  // Whisper (speech-to-text)
  'whisper:init',
  'whisper:transcribe',
  'whisper:getInfo',
  'whisper:getModels',
  'whisper:setModel',
  'whisper:downloadModel',
  'whisper:deleteModel',
  'whisper:cancelDownload',
  // LLM
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
  // Logging
  'logs:get',
  'logs:getAll',
  'logs:clear',
  'logs:getPath',
  'logs:write',
])

// ============================================
// Model Name Allowlists
// ============================================

export const ALLOWED_WHISPER_MODELS = new Set([
  'tiny',
  'tiny.en',
  'base',
  'base.en',
  'small',
  'small.en',
  'medium',
  'medium.en',
])

export const ALLOWED_LLM_MODELS = new Set([
  'tinyllama-1.1b',
  'phi-2',
  'mistral-7b-instruct',
  'llama-3.2-1b',
  'llama-3.2-3b',
])

// ============================================
// Path Validation
// ============================================

/**
 * Validates that a path is within allowed directories
 * Prevents path traversal attacks
 */
export function isPathWithinDirectory(filePath: string, allowedDir: string): boolean {
  const resolved = path.resolve(filePath)
  const resolvedAllowed = path.resolve(allowedDir)
  return resolved.startsWith(resolvedAllowed + path.sep) || resolved === resolvedAllowed
}

/**
 * Validates export file path is in a safe location
 * Only allows paths returned by save dialog (user-selected)
 */
export function validateExportPath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') {
    return false
  }

  // Must be absolute path
  if (!path.isAbsolute(filePath)) {
    log.warn('Export path must be absolute', { filePath }, 'security')
    return false
  }

  // Must end with allowed extension
  const ext = path.extname(filePath).toLowerCase()
  if (!['.pdf', '.md', '.txt', '.json'].includes(ext)) {
    log.warn('Invalid export file extension', { filePath, ext }, 'security')
    return false
  }

  // Block sensitive directories (don't write to system folders)
  const blocked = ['/System', '/Library', '/usr', '/bin', '/sbin', '/etc', '/var']
  if (blocked.some(dir => filePath.startsWith(dir))) {
    log.warn('Export to system directory blocked', { filePath }, 'security')
    return false
  }

  return true
}

// ============================================
// Input Sanitization
// ============================================

/**
 * Sanitizes a session ID to prevent path traversal
 * Only allows alphanumeric characters, hyphens, and underscores
 */
export function sanitizeSessionId(sessionId: string, sessionsPath: string): string | null {
  if (!sessionId || typeof sessionId !== 'string') {
    return null
  }

  // Only allow UUID-like patterns
  const sanitized = sessionId.replace(/[^a-zA-Z0-9\-_]/g, '')

  if (sanitized.length === 0 || sanitized !== sessionId) {
    log.warn('Invalid session ID rejected', { sessionId }, 'security')
    return null
  }

  // Verify resolved path stays within sessions directory
  const resolvedPath = path.resolve(sessionsPath, sanitized)
  if (!isPathWithinDirectory(resolvedPath, sessionsPath)) {
    log.warn('Path traversal attempt blocked', { sessionId }, 'security')
    return null
  }

  return sanitized
}

/**
 * Validates model name against allowlist
 */
export function validateModelName(
  modelName: string, 
  allowlist: Set<string>,
  modelType: 'whisper' | 'llm'
): boolean {
  if (!modelName || typeof modelName !== 'string') {
    log.warn(`Invalid ${modelType} model name type`, { modelName }, 'security')
    return false
  }

  if (!allowlist.has(modelName)) {
    log.warn(`Unknown ${modelType} model rejected`, { modelName }, 'security')
    return false
  }

  return true
}

/**
 * Validates slide index is a safe integer
 */
export function validateSlideIndex(slideIndex: number): number | null {
  if (
    typeof slideIndex !== 'number' || 
    !Number.isInteger(slideIndex) || 
    slideIndex < 0 ||
    slideIndex > 10000 // Reasonable upper bound
  ) {
    return null
  }
  return slideIndex
}

/**
 * Sanitizes log data to remove sensitive information
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }

  if (typeof data === 'string') {
    // Truncate very long strings (potential data exfil)
    if (data.length > 1000) {
      return data.slice(0, 1000) + '...[truncated]'
    }
    // Redact base64 data (images, audio)
    if (data.length > 100 && /^[A-Za-z0-9+/=]+$/.test(data)) {
      return '[base64 data redacted]'
    }
    return data
  }

  if (Array.isArray(data)) {
    return data.slice(0, 10).map(sanitizeLogData)
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {}
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'audioData', 'imageData', 'data']
    
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[redacted]'
      } else {
        sanitized[key] = sanitizeLogData(value)
      }
    }
    return sanitized
  }

  return data
}

// ============================================
// Download Integrity
// ============================================

/**
 * Validates download URL is from trusted sources (HTTPS only)
 */
export function isAllowedDownloadUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  const trustedHosts = [
    'huggingface.co',
    'cdn-lfs.huggingface.co',
    'cdn-lfs-us-1.huggingface.co',
  ]

  try {
    const parsed = new URL(url)
    
    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return false
    }
    
    return trustedHosts.some(host => 
      parsed.hostname === host || parsed.hostname.endsWith('.' + host)
    )
  } catch {
    return false
  }
}

/**
 * Computes SHA256 hash of a file for integrity verification
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const fs = await import('fs')
  const fsPromises = await import('fs/promises')
  
  const fileBuffer = await fsPromises.readFile(filePath)
  return crypto.createHash('sha256').update(fileBuffer).digest('hex')
}

// ============================================
// Audit Logging
// ============================================

interface AuditEvent {
  action: string
  success: boolean
  details?: Record<string, unknown>
  timestamp: string
}

/**
 * Logs security-relevant events for audit trail
 */
export function auditLog(
  action: string, 
  success: boolean, 
  details?: Record<string, unknown>
): void {
  const event: AuditEvent = {
    action,
    success,
    details: details ? sanitizeLogData(details) as Record<string, unknown> : undefined,
    timestamp: new Date().toISOString(),
  }

  if (success) {
    log.info(`[AUDIT] ${action}`, event, 'security')
  } else {
    log.warn(`[AUDIT] ${action} FAILED`, event, 'security')
  }
}

// ============================================
// Content Security Policy
// ============================================

/**
 * Returns CSP header value for the application
 * Restricts resource loading to prevent XSS
 */
export function getContentSecurityPolicy(isDev: boolean): string {
  const directives = [
    // Default: only load from self
    "default-src 'self'",
    // Scripts: self + unsafe-eval needed for PDF.js worker
    `script-src 'self'${isDev ? " 'unsafe-eval'" : ''}`,
    // Styles: self + inline (for dynamically generated styles)
    "style-src 'self' 'unsafe-inline'",
    // Images: self + data URIs (for slide images) + blob (for canvas)
    "img-src 'self' data: blob:",
    // Fonts: self
    "font-src 'self'",
    // Connect: self + dev server in dev mode
    `connect-src 'self'${isDev ? ' ws://localhost:* http://localhost:*' : ''}`,
    // Media: self + blob (for audio recording)
    "media-src 'self' blob:",
    // Workers: self + blob (for PDF.js worker)
    "worker-src 'self' blob:",
    // Object/embed: none
    "object-src 'none'",
    // Base URI: self
    "base-uri 'self'",
    // Form action: self
    "form-action 'self'",
    // Frame ancestors: none (not embeddable)
    "frame-ancestors 'none'",
  ]

  return directives.join('; ')
}

// ============================================
// Rate Limiting (simple in-memory)
// ============================================

const rateLimitMap = new Map<string, number[]>()

/**
 * Simple rate limiter for IPC calls
 * Returns true if request should be allowed
 */
export function checkRateLimit(
  channel: string, 
  maxRequests: number = 100, 
  windowMs: number = 60000
): boolean {
  const now = Date.now()
  const key = channel
  
  let timestamps = rateLimitMap.get(key) || []
  
  // Remove old timestamps
  timestamps = timestamps.filter(t => now - t < windowMs)
  
  if (timestamps.length >= maxRequests) {
    log.warn('Rate limit exceeded', { channel, count: timestamps.length }, 'security')
    return false
  }
  
  timestamps.push(now)
  rateLimitMap.set(key, timestamps)
  
  return true
}

