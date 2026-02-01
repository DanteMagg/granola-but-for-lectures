import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron modules before importing security
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data')
  }
}))

vi.mock('../main/logger.js', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

import {
  IPC_CHANNEL_ALLOWLIST,
  ALLOWED_WHISPER_MODELS,
  ALLOWED_LLM_MODELS,
  isPathWithinDirectory,
  validateExportPath,
  sanitizeSessionId,
  validateModelName,
  validateSlideIndex,
  sanitizeLogData,
  isAllowedDownloadUrl,
  getContentSecurityPolicy,
  checkRateLimit,
  auditLog
} from '../main/security'

describe('security utilities', () => {
  describe('IPC_CHANNEL_ALLOWLIST', () => {
    it('contains expected core channels', () => {
      expect(IPC_CHANNEL_ALLOWLIST.has('session:save')).toBe(true)
      expect(IPC_CHANNEL_ALLOWLIST.has('session:load')).toBe(true)
      expect(IPC_CHANNEL_ALLOWLIST.has('dialog:openPdf')).toBe(true)
      expect(IPC_CHANNEL_ALLOWLIST.has('llm:generate')).toBe(true)
      expect(IPC_CHANNEL_ALLOWLIST.has('whisper:transcribe')).toBe(true)
    })

    it('does not contain arbitrary channels', () => {
      expect(IPC_CHANNEL_ALLOWLIST.has('arbitrary:channel')).toBe(false)
      expect(IPC_CHANNEL_ALLOWLIST.has('shell:execute')).toBe(false)
      expect(IPC_CHANNEL_ALLOWLIST.has('fs:readFile')).toBe(false)
    })
  })

  describe('isPathWithinDirectory', () => {
    it('allows paths within directory', () => {
      expect(isPathWithinDirectory('/data/sessions/abc', '/data/sessions')).toBe(true)
      expect(isPathWithinDirectory('/data/sessions/abc/file.json', '/data/sessions')).toBe(true)
    })

    it('blocks path traversal attempts', () => {
      expect(isPathWithinDirectory('/data/sessions/../secrets', '/data/sessions')).toBe(false)
      expect(isPathWithinDirectory('/data/sessions/../../etc/passwd', '/data/sessions')).toBe(false)
    })

    it('blocks absolute paths outside directory', () => {
      expect(isPathWithinDirectory('/etc/passwd', '/data/sessions')).toBe(false)
      expect(isPathWithinDirectory('/home/user/file', '/data/sessions')).toBe(false)
    })
  })

  describe('validateExportPath', () => {
    it('allows valid export paths', () => {
      expect(validateExportPath('/Users/test/Documents/notes.pdf')).toBe(true)
      expect(validateExportPath('/home/user/exports/lecture.md')).toBe(true)
      expect(validateExportPath('/tmp/export.json')).toBe(true)
    })

    it('rejects invalid extensions', () => {
      expect(validateExportPath('/home/user/test.exe')).toBe(false)
      expect(validateExportPath('/home/user/script.sh')).toBe(false)
    })

    it('rejects relative paths', () => {
      expect(validateExportPath('./output.pdf')).toBe(false)
      expect(validateExportPath('output.pdf')).toBe(false)
    })

    it('rejects system directories', () => {
      expect(validateExportPath('/System/Library/test.pdf')).toBe(false)
      expect(validateExportPath('/usr/bin/test.pdf')).toBe(false)
      expect(validateExportPath('/etc/test.pdf')).toBe(false)
    })

    it('rejects invalid input', () => {
      expect(validateExportPath('')).toBe(false)
      expect(validateExportPath(null as any)).toBe(false)
      expect(validateExportPath(undefined as any)).toBe(false)
    })
  })

  describe('sanitizeSessionId', () => {
    const sessionsPath = '/data/sessions'

    it('allows valid session IDs', () => {
      expect(sanitizeSessionId('abc-123-def', sessionsPath)).toBe('abc-123-def')
      expect(sanitizeSessionId('session_001', sessionsPath)).toBe('session_001')
      expect(sanitizeSessionId('f47ac10b-58cc-4372-a567-0e02b2c3d479', sessionsPath)).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
    })

    it('rejects path traversal attempts', () => {
      expect(sanitizeSessionId('../secret', sessionsPath)).toBe(null)
      expect(sanitizeSessionId('..%2F..%2Fetc', sessionsPath)).toBe(null)
      expect(sanitizeSessionId('abc/../../../etc/passwd', sessionsPath)).toBe(null)
    })

    it('rejects special characters', () => {
      expect(sanitizeSessionId('abc/def', sessionsPath)).toBe(null)
      expect(sanitizeSessionId('abc\\def', sessionsPath)).toBe(null)
      expect(sanitizeSessionId('abc;rm -rf', sessionsPath)).toBe(null)
    })

    it('rejects invalid input', () => {
      expect(sanitizeSessionId('', sessionsPath)).toBe(null)
      expect(sanitizeSessionId(null as any, sessionsPath)).toBe(null)
    })
  })

  describe('validateModelName', () => {
    it('allows valid whisper models', () => {
      expect(validateModelName('tiny', ALLOWED_WHISPER_MODELS, 'whisper')).toBe(true)
      expect(validateModelName('base.en', ALLOWED_WHISPER_MODELS, 'whisper')).toBe(true)
      expect(validateModelName('medium', ALLOWED_WHISPER_MODELS, 'whisper')).toBe(true)
    })

    it('allows valid LLM models', () => {
      expect(validateModelName('tinyllama-1.1b', ALLOWED_LLM_MODELS, 'llm')).toBe(true)
      expect(validateModelName('phi-2', ALLOWED_LLM_MODELS, 'llm')).toBe(true)
      expect(validateModelName('llama-3.2-3b', ALLOWED_LLM_MODELS, 'llm')).toBe(true)
    })

    it('rejects unknown models', () => {
      expect(validateModelName('malicious-model', ALLOWED_WHISPER_MODELS, 'whisper')).toBe(false)
      expect(validateModelName('large', ALLOWED_WHISPER_MODELS, 'whisper')).toBe(false)
      expect(validateModelName('gpt-4', ALLOWED_LLM_MODELS, 'llm')).toBe(false)
    })

    it('rejects invalid input', () => {
      expect(validateModelName('', ALLOWED_LLM_MODELS, 'llm')).toBe(false)
      expect(validateModelName(null as any, ALLOWED_LLM_MODELS, 'llm')).toBe(false)
    })
  })

  describe('validateSlideIndex', () => {
    it('allows valid indices', () => {
      expect(validateSlideIndex(0)).toBe(0)
      expect(validateSlideIndex(1)).toBe(1)
      expect(validateSlideIndex(100)).toBe(100)
    })

    it('rejects negative indices', () => {
      expect(validateSlideIndex(-1)).toBe(null)
      expect(validateSlideIndex(-100)).toBe(null)
    })

    it('rejects non-integers', () => {
      expect(validateSlideIndex(1.5)).toBe(null)
      expect(validateSlideIndex(NaN)).toBe(null)
      expect(validateSlideIndex(Infinity)).toBe(null)
    })

    it('rejects unreasonably large indices', () => {
      expect(validateSlideIndex(10001)).toBe(null)
      expect(validateSlideIndex(1000000)).toBe(null)
    })
  })

  describe('sanitizeLogData', () => {
    it('passes through simple data', () => {
      expect(sanitizeLogData('hello')).toBe('hello')
      expect(sanitizeLogData(123)).toBe(123)
      expect(sanitizeLogData(null)).toBe(null)
    })

    it('truncates long strings', () => {
      const longString = 'a'.repeat(2000)
      const result = sanitizeLogData(longString) as string
      expect(result.length).toBeLessThan(longString.length)
      expect(result).toContain('[truncated]')
    })

    it('redacts base64 data', () => {
      // Must be > 100 chars to trigger base64 detection
      const base64 = 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBsb25nIGJhc2U2NCBzdHJpbmcgdGhhdCBzaG91bGQgYmUgcmVkYWN0ZWRBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWg=='
      expect(base64.length).toBeGreaterThan(100)
      expect(sanitizeLogData(base64)).toBe('[base64 data redacted]')
    })

    it('redacts sensitive keys in objects', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        token: 'abc123',
        imageData: 'base64stuff'
      }
      const result = sanitizeLogData(data) as Record<string, unknown>
      expect(result.username).toBe('john')
      expect(result.password).toBe('[redacted]')
      expect(result.token).toBe('[redacted]')
      expect(result.imageData).toBe('[redacted]')
    })

    it('limits array length', () => {
      const data = Array(100).fill('item')
      const result = sanitizeLogData(data) as unknown[]
      expect(result.length).toBe(10)
    })
  })

  describe('isAllowedDownloadUrl', () => {
    it('allows Hugging Face URLs', () => {
      expect(isAllowedDownloadUrl('https://huggingface.co/models/test.bin')).toBe(true)
      expect(isAllowedDownloadUrl('https://cdn-lfs.huggingface.co/file.gguf')).toBe(true)
    })

    it('rejects other URLs', () => {
      expect(isAllowedDownloadUrl('https://evil.com/malware.bin')).toBe(false)
      expect(isAllowedDownloadUrl('https://github.com/file.bin')).toBe(false)
      expect(isAllowedDownloadUrl('http://huggingface.co/insecure')).toBe(false)
    })

    it('rejects invalid input', () => {
      expect(isAllowedDownloadUrl('')).toBe(false)
      expect(isAllowedDownloadUrl('not-a-url')).toBe(false)
      expect(isAllowedDownloadUrl(null as any)).toBe(false)
    })
  })

  describe('getContentSecurityPolicy', () => {
    it('returns CSP string', () => {
      const csp = getContentSecurityPolicy(false)
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("frame-ancestors 'none'")
    })

    it('includes dev-specific rules in dev mode', () => {
      const csp = getContentSecurityPolicy(true)
      expect(csp).toContain('ws://localhost')
      expect(csp).toContain("'unsafe-eval'")
    })

    it('excludes dev rules in production', () => {
      const csp = getContentSecurityPolicy(false)
      expect(csp).not.toContain('ws://localhost')
    })
  })

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear rate limit state between tests by waiting
      vi.useFakeTimers()
    })

    it('allows requests under limit', () => {
      vi.useRealTimers()
      expect(checkRateLimit('test:channel', 10, 1000)).toBe(true)
      expect(checkRateLimit('test:channel', 10, 1000)).toBe(true)
    })

    it('blocks requests over limit', () => {
      vi.useRealTimers()
      const channel = 'flood:test:' + Date.now()
      for (let i = 0; i < 5; i++) {
        checkRateLimit(channel, 5, 60000)
      }
      expect(checkRateLimit(channel, 5, 60000)).toBe(false)
    })
  })

  describe('auditLog', () => {
    it('logs successful events', async () => {
      const logModule = await vi.importMock('../main/logger.js')
      auditLog('session:create', true, { sessionId: 'abc-123' })
      expect(logModule.log.info).toHaveBeenCalled()
    })

    it('logs failed events as warnings', async () => {
      const logModule = await vi.importMock('../main/logger.js')
      auditLog('session:create', false, { error: 'Invalid ID' })
      expect(logModule.log.warn).toHaveBeenCalled()
    })
  })
})

