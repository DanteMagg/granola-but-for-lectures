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

// ============================================
// Input Size Limits
// ============================================

const INPUT_SIZE_LIMITS = {
  audioBase64: 50 * 1024 * 1024, // 50MB max audio (base64)
  llmPrompt: 32 * 1024, // 32KB max prompt
  llmContext: 64 * 1024, // 64KB max context
  llmSystemPrompt: 8 * 1024, // 8KB max system prompt
  exportSessionName: 500, // 500 chars max session name
  exportSlideNote: 50 * 1024, // 50KB max note per slide
  exportSlideTranscript: 100 * 1024, // 100KB max transcript per slide
}

/**
 * Validates and truncates audio base64 input
 */
export function validateAudioInput(audioBase64: string): { valid: boolean; error?: string } {
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return { valid: false, error: 'Invalid audio input type' }
  }
  
  if (audioBase64.length > INPUT_SIZE_LIMITS.audioBase64) {
    log.warn('Audio input too large', { 
      size: audioBase64.length, 
      limit: INPUT_SIZE_LIMITS.audioBase64 
    }, 'security')
    return { valid: false, error: 'Audio data exceeds size limit (50MB)' }
  }
  
  // Basic base64 format check
  if (!/^[A-Za-z0-9+/=]*$/.test(audioBase64)) {
    return { valid: false, error: 'Invalid base64 format' }
  }
  
  return { valid: true }
}

/**
 * Validates LLM generation request
 */
export function validateLLMRequest(request: {
  prompt?: string
  context?: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}): { valid: boolean; sanitized?: typeof request; error?: string } {
  if (!request || typeof request !== 'object') {
    return { valid: false, error: 'Invalid request object' }
  }
  
  const { prompt, context, systemPrompt, maxTokens, temperature } = request
  
  // Validate prompt (required)
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'Prompt is required' }
  }
  
  if (prompt.length > INPUT_SIZE_LIMITS.llmPrompt) {
    log.warn('LLM prompt too large', { 
      size: prompt.length, 
      limit: INPUT_SIZE_LIMITS.llmPrompt 
    }, 'security')
    return { valid: false, error: 'Prompt exceeds size limit (32KB)' }
  }
  
  // Validate optional context
  if (context !== undefined && typeof context !== 'string') {
    return { valid: false, error: 'Context must be a string' }
  }
  
  if (context && context.length > INPUT_SIZE_LIMITS.llmContext) {
    log.warn('LLM context too large, truncating', { 
      size: context.length, 
      limit: INPUT_SIZE_LIMITS.llmContext 
    }, 'security')
  }
  
  // Validate optional systemPrompt
  if (systemPrompt !== undefined && typeof systemPrompt !== 'string') {
    return { valid: false, error: 'System prompt must be a string' }
  }
  
  if (systemPrompt && systemPrompt.length > INPUT_SIZE_LIMITS.llmSystemPrompt) {
    log.warn('LLM system prompt too large, truncating', { 
      size: systemPrompt.length, 
      limit: INPUT_SIZE_LIMITS.llmSystemPrompt 
    }, 'security')
  }
  
  // Validate maxTokens
  if (maxTokens !== undefined) {
    if (typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 8192) {
      return { valid: false, error: 'maxTokens must be an integer between 1 and 8192' }
    }
  }
  
  // Validate temperature
  if (temperature !== undefined) {
    if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
      return { valid: false, error: 'temperature must be between 0 and 2' }
    }
  }
  
  // Return sanitized request with truncated values
  return {
    valid: true,
    sanitized: {
      prompt,
      context: context?.slice(0, INPUT_SIZE_LIMITS.llmContext),
      systemPrompt: systemPrompt?.slice(0, INPUT_SIZE_LIMITS.llmSystemPrompt),
      maxTokens: maxTokens ?? 1024,
      temperature: temperature ?? 0.7,
    },
  }
}

/**
 * Validates export data structure
 */
export function validateExportData(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Export data must be an object' }
  }
  
  const exportData = data as Record<string, unknown>
  
  // Validate required fields
  if (typeof exportData.sessionName !== 'string') {
    return { valid: false, error: 'sessionName must be a string' }
  }
  
  if (exportData.sessionName.length > INPUT_SIZE_LIMITS.exportSessionName) {
    return { valid: false, error: 'sessionName too long' }
  }
  
  if (typeof exportData.exportedAt !== 'string') {
    return { valid: false, error: 'exportedAt must be a string' }
  }
  
  if (!Array.isArray(exportData.slides)) {
    return { valid: false, error: 'slides must be an array' }
  }
  
  // Validate each slide
  for (const slide of exportData.slides) {
    if (typeof slide !== 'object' || slide === null) {
      return { valid: false, error: 'Each slide must be an object' }
    }
    
    const s = slide as Record<string, unknown>
    
    if (typeof s.index !== 'number') {
      return { valid: false, error: 'Slide index must be a number' }
    }
    
    // imageData can be string or null
    if (s.imageData !== null && typeof s.imageData !== 'string') {
      return { valid: false, error: 'Slide imageData must be string or null' }
    }
    
    // note can be string or null
    if (s.note !== null && typeof s.note !== 'string') {
      return { valid: false, error: 'Slide note must be string or null' }
    }
    
    if (typeof s.note === 'string' && s.note.length > INPUT_SIZE_LIMITS.exportSlideNote) {
      return { valid: false, error: 'Slide note exceeds size limit' }
    }
    
    // transcript can be string or null
    if (s.transcript !== null && typeof s.transcript !== 'string') {
      return { valid: false, error: 'Slide transcript must be string or null' }
    }
    
    if (typeof s.transcript === 'string' && s.transcript.length > INPUT_SIZE_LIMITS.exportSlideTranscript) {
      return { valid: false, error: 'Slide transcript exceeds size limit' }
    }
  }
  
  return { valid: true }
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

