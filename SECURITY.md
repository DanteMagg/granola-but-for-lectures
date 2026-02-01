# Security Audit & Hardening

## Overview

This document outlines the security measures implemented in Lecture Note Companion, an Electron app that handles sensitive academic content.

## Threat Model

| Asset | Risk | Mitigation |
|-------|------|------------|
| User lecture notes | Data exfiltration | Local storage, no cloud sync |
| PDF files | Malicious payloads | Sandboxed parsing in renderer |
| AI model downloads | MITM/tampering | HTTPS-only, trusted hosts |
| Audio recordings | Privacy breach | Local processing only |
| Filesystem access | Path traversal | Strict sanitization |

## Security Checklist

### ✅ Electron Configuration

```typescript
// src/main/index.ts
webPreferences: {
  nodeIntegration: false,      // ✅ Prevents require() in renderer
  contextIsolation: true,      // ✅ Isolates preload from renderer
  sandbox: true,               // ✅ Enables renderer sandbox
  webSecurity: true,           // ✅ Enforces same-origin policy
  allowRunningInsecureContent: false, // ✅ Blocks mixed content
}
```

### ✅ Content Security Policy

Production CSP (set via `session.webRequest.onHeadersReceived`):
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self';
worker-src 'self' blob:;
frame-src 'none';
object-src 'none';
base-uri 'self';
```

### ✅ IPC Security

1. **Channel Allowlist**: Only explicitly listed channels are allowed
2. **Input Validation**: All IPC handlers validate input parameters
3. **No arbitrary command execution**: No shell or eval exposed

Allowlisted channels:
- `dialog:openPdf` - Opens native file picker (OS-controlled)
- `session:*` - CRUD with sanitized session IDs
- `audio:*` - Audio save with validated slide indices
- `export:*` - Export with path validation
- `whisper:*` / `llm:*` - AI with model name validation

### ✅ Path Security

**Session ID Sanitization** (`sanitizeSessionId`):
- Only allows `[a-zA-Z0-9\-_]`
- Validates resolved path stays within sessions directory
- Blocks path traversal (`../`, encoded variants)

**Export Path Validation** (`validateExportPath`):
- Requires absolute paths
- Only allows `.pdf`, `.md`, `.txt`, `.json` extensions
- Blocks system directories (`/System`, `/usr`, `/etc`, etc.)

### ✅ Model Download Security

**URL Validation** (`isAllowedDownloadUrl` in `security.ts`):
- HTTPS only
- Trusted hosts only: `huggingface.co`, `cdn-lfs.huggingface.co`

**Model Name Validation**:
- Both Whisper and LLM bridges validate against hardcoded model dictionaries
- Unknown model names are rejected

### ✅ Navigation Security

- External URL navigation blocked
- New window creation blocked
- Only localhost (dev) and file:// (prod) allowed

## Security Utilities

The `src/main/security.ts` module provides:

| Function | Purpose |
|----------|---------|
| `sanitizeSessionId()` | Validate/sanitize session IDs |
| `validateExportPath()` | Validate export file paths |
| `validateModelName()` | Check model names against allowlist |
| `validateSlideIndex()` | Validate slide indices |
| `isAllowedDownloadUrl()` | Verify download URLs |
| `sanitizeLogData()` | Redact sensitive data from logs |
| `auditLog()` | Security event logging |
| `checkRateLimit()` | Simple rate limiting |
| `getContentSecurityPolicy()` | Generate CSP string |

## Audit Logging

Security events are logged with `[AUDIT]` prefix:
- Session create/delete
- Export operations
- Model downloads
- Blocked requests

Logs are sanitized to remove:
- Base64 encoded data (images, audio)
- Password/token/secret fields
- Long strings (>1000 chars)

## PDF Parsing Security

PDF parsing uses `pdfjs-dist` in the **renderer process**:
- Runs in sandboxed renderer
- No filesystem access from parser
- Text extraction only (no script execution)

## Recommendations for Future

1. **Subresource Integrity (SRI)**: Add checksums for downloaded models
2. **Certificate Pinning**: Pin HuggingFace certificates for downloads
3. **Encrypted Storage**: Encrypt session data at rest
4. **Auto-update Security**: Sign updates when implementing auto-update

## Testing

Security tests are in `src/__tests__/security.test.ts`:
```bash
npm test -- src/__tests__/security.test.ts
```

Tests cover:
- Path traversal prevention
- Session ID sanitization
- Model name validation
- URL validation
- Rate limiting
- Log sanitization

