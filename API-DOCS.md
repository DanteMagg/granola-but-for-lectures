# Lecture Note Companion - API Documentation

Internal API documentation for the Lecture Note Companion application.

---

## Table of Contents

1. [Hooks](#hooks)
   - [useAudio](#useaudio)
   - [useLocalAI](#uselocalai)
   - [useNoteEnhancement](#usenoteenhancement)
   - [usePdfImport](#usepdfimport)
   - [useSession](#usesession)
   - [useAccessibility](#useaccessibility)
   - [useFocusTrap](#usefocustrap)
2. [Stores](#stores)
   - [sessionStore](#sessionstore)
   - [notesStore](#notesstore)
   - [slideStore](#slidestore)
   - [transcriptStore](#transcriptstore)
   - [toastStore](#toaststore)
3. [Libraries](#libraries)
   - [sessionValidator](#sessionvalidator)
   - [transcription](#transcription)
   - [transcript-processor](#transcript-processor)
   - [logger](#logger)
   - [performance](#performance)
4. [Prompts](#prompts)
   - [enhance-notes](#enhance-notes)
   - [chat-prompts](#chat-prompts)
5. [Types](#types)
6. [Constants](#constants)

---

## Hooks

### useAudio

**Overview**

React hook for managing audio recording, Whisper model initialization, and real-time transcription. Handles microphone access, audio level visualization, and streaming transcription via the Electron API.

**Parameters**

None - this is a parameterless hook.

**Return Value**

| Property | Type | Description |
|----------|------|-------------|
| `isRecording` | `boolean` | Whether recording is currently active |
| `isPaused` | `boolean` | Whether recording is paused |
| `duration` | `number` | Recording duration in milliseconds |
| `audioLevel` | `number` | Current audio level (0-1) for visualization |
| `error` | `string \| null` | Error message if recording failed |
| `isTranscribing` | `boolean` | Whether transcription is in progress |
| `whisperInfo` | `WhisperModelInfo \| null` | Whisper model status and available models |
| `downloadProgress` | `DownloadProgress \| null` | Model download progress |
| `startRecording` | `() => Promise<void>` | Start audio recording |
| `stopRecording` | `() => void` | Stop recording and trigger transcription |
| `pauseRecording` | `() => void` | Pause active recording |
| `resumeRecording` | `() => void` | Resume paused recording |
| `initWhisper` | `() => Promise<boolean>` | Initialize Whisper model |
| `downloadWhisperModel` | `(modelName: string) => Promise<{success, error?}>` | Download a Whisper model |
| `cancelWhisperDownload` | `() => Promise<void>` | Cancel ongoing download |
| `setWhisperModel` | `(modelName: string) => Promise<boolean>` | Switch active model |
| `refreshWhisperInfo` | `() => Promise<void>` | Refresh model info from backend |

**Errors**

| Error | When |
|-------|------|
| `"Could not access microphone. Please check permissions."` | Microphone access denied |
| `"Failed to init Whisper"` | Whisper initialization failed |
| `"Download failed"` | Model download failed |

**Examples**

```tsx
// Basic recording
const { isRecording, startRecording, stopRecording, audioLevel } = useAudio()

const handleRecord = async () => {
  if (isRecording) {
    stopRecording()
  } else {
    await startRecording()
  }
}

// Audio level visualization
<div style={{ width: `${audioLevel * 100}%` }} className="audio-bar" />
```

```tsx
// Model management
const { whisperInfo, downloadWhisperModel, downloadProgress } = useAudio()

if (!whisperInfo?.loaded) {
  await downloadWhisperModel('base.en')
}

// Show download progress
{downloadProgress && (
  <ProgressBar value={downloadProgress.percent} />
)}
```

**Notes**

- Audio is recorded in WebM/Opus format at 16kHz mono (Whisper-compatible)
- Transcription occurs every 5 chunks (~5 seconds) during recording
- Final transcription runs when recording stops
- Uses `MediaRecorder` API - browser support required
- Cleans up all resources (streams, contexts) on unmount

---

### useLocalAI

**Overview**

React hook for interacting with the local LLM (Large Language Model) via Electron IPC. Supports both streaming and non-streaming generation, model management, and automatic context building from current slide data.

**Parameters**

None - this is a parameterless hook.

**Return Value**

| Property | Type | Description |
|----------|------|-------------|
| `isLoading` | `boolean` | Whether a generation request is in progress |
| `error` | `string \| null` | Error message from last failed request |
| `modelInfo` | `LLMModelInfo \| null` | Current model status and available models |
| `isModelLoaded` | `boolean` | Convenience boolean for `modelInfo?.loaded` |
| `downloadProgress` | `DownloadProgress \| null` | Model download progress |
| `sendMessage` | `(message: string, context?: string) => Promise<string>` | Send message, get complete response |
| `sendMessageStream` | `(message: string, context?: string, onChunk?: (chunk: string) => void) => Promise<string>` | Send message with streaming response |
| `initModel` | `() => Promise<boolean>` | Initialize the LLM |
| `downloadModel` | `(modelName: string) => Promise<{success, error?}>` | Download a model |
| `cancelDownload` | `() => Promise<void>` | Cancel ongoing download |
| `setModel` | `(modelName: string) => Promise<boolean>` | Switch active model |
| `refreshModelInfo` | `() => Promise<void>` | Refresh model info from backend |

**Errors**

| Error | When |
|-------|------|
| `"LLM API not available"` | Electron API not present (browser mode) |
| `"AI request failed"` | Generation failed |

**Examples**

```tsx
// Non-streaming generation
const { sendMessage, isLoading } = useLocalAI()

const response = await sendMessage("Explain this concept")
```

```tsx
// Streaming generation with live updates
const { sendMessageStream } = useLocalAI()
const [response, setResponse] = useState('')

await sendMessageStream(
  "Summarize these notes",
  undefined,
  (chunk) => setResponse(prev => prev + chunk)
)
```

```tsx
// With custom context
const { sendMessage } = useLocalAI()

const response = await sendMessage(
  "What are the key points?",
  "Slide content: Machine Learning basics..."
)
```

**Notes**

- Automatically builds context from current slide (text, notes, transcript)
- Falls back to non-streaming if streaming API unavailable
- Cleans up IPC listeners on unmount
- Context is optional - defaults to current slide context

---

### useNoteEnhancement

**Overview**

React hook implementing the Granola-style note enhancement workflow. Merges user notes with transcripts using the LLM to create comprehensive, study-ready notes. Supports single-slide and bulk enhancement.

**Parameters**

None - this is a parameterless hook.

**Return Value**

| Property | Type | Description |
|----------|------|-------------|
| `enhanceSlide` | `(slideId: string) => Promise<void>` | Enhance notes for a single slide |
| `enhanceAllSlides` | `() => Promise<void>` | Enhance all slides with transcripts/notes |
| `cancelEnhancement` | `() => void` | Cancel ongoing enhancement |
| `progress` | `EnhancementProgress` | Current progress state |
| `isLLMAvailable` | `boolean` | Whether LLM is loaded and ready |
| `checkLLMStatus` | `() => Promise<boolean>` | Check if LLM is available |

**EnhancementProgress Type**

```ts
interface EnhancementProgress {
  currentSlide: number   // 1-based index of slide being processed
  totalSlides: number    // Total slides to enhance
  status: 'idle' | 'enhancing' | 'complete' | 'error'
  error?: string
}
```

**Errors**

| Error | When |
|-------|------|
| `"LLM not available"` | Model not loaded |
| `"Enhancement failed"` | LLM generation error |

**Examples**

```tsx
// Single slide enhancement
const { enhanceSlide, isLLMAvailable } = useNoteEnhancement()

if (isLLMAvailable) {
  await enhanceSlide(currentSlide.id)
}
```

```tsx
// Bulk enhancement with progress
const { enhanceAllSlides, progress, cancelEnhancement } = useNoteEnhancement()

await enhanceAllSlides()

// Show progress
<ProgressBar 
  value={progress.currentSlide} 
  max={progress.totalSlides}
/>

// Cancel button
<button onClick={cancelEnhancement}>Cancel</button>
```

**Notes**

- Only enhances slides with transcripts or notes (skips empty slides)
- Updates session phase (`enhancing` → `enhanced`)
- Reads fresh state from store for each slide to avoid stale closures
- Cancel sets flag but cannot abort in-flight LLM requests

---

### usePdfImport

**Overview**

React hook for importing PDF files into the application. Handles file dialog, drag-and-drop, PDF rendering, text extraction, and slide creation. Includes security validations for file size and page count.

**Parameters**

None - this is a parameterless hook.

**Return Value**

| Property | Type | Description |
|----------|------|-------------|
| `importPdf` | `() => Promise<void>` | Open file dialog and import selected PDF |
| `importPdfFromFile` | `(file: File) => Promise<boolean>` | Import from File object (drag-and-drop) |
| `isImporting` | `boolean` | Whether import is in progress |
| `progress` | `number` | Import progress (0-100) |
| `error` | `string \| null` | Error message if import failed |

**Errors**

| Error | When |
|-------|------|
| `"PDF file too large"` | File exceeds 100MB |
| `"PDF has too many pages"` | More than 500 pages |
| `"Please drop a PDF file"` | Non-PDF file dropped |
| `"Failed to import PDF"` | PDF parsing/rendering error |

**Examples**

```tsx
// Import via dialog
const { importPdf, isImporting, progress } = usePdfImport()

<button onClick={importPdf} disabled={isImporting}>
  {isImporting ? `Importing... ${progress}%` : 'Import PDF'}
</button>
```

```tsx
// Drag and drop
const { importPdfFromFile, error } = usePdfImport()

const handleDrop = async (e: DragEvent) => {
  const file = e.dataTransfer.files[0]
  const success = await importPdfFromFile(file)
  if (!success) {
    console.error(error)
  }
}
```

**Notes**

- Uses PDF.js for rendering with security options (`disableAutoFetch`, `isEvalSupported: false`)
- Renders at 2x scale for quality
- Extracts text content per page
- Creates placeholder slides for failed pages
- Updates session name from filename if unnamed
- Shows toast notifications on success/failure

---

### useSession

**Overview**

React hook for session lifecycle management. Wraps the session store with initialization logic and auto-save on window close.

**Parameters**

None - this is a parameterless hook.

**Return Value**

| Property | Type | Description |
|----------|------|-------------|
| `session` | `Session \| null` | Current session |
| `sessionList` | `SessionListItem[]` | All saved sessions |
| `isLoading` | `boolean` | Loading state |
| `isSaving` | `boolean` | Saving state |
| `createSession` | `(name?: string) => Promise<Session>` | Create new session |
| `loadSession` | `(sessionId: string) => Promise<void>` | Load existing session |
| `saveSession` | `() => Promise<void>` | Save current session |
| `deleteSession` | `(sessionId: string) => Promise<void>` | Delete a session |
| `refreshSessionList` | `() => Promise<void>` | Refresh session list |

**Examples**

```tsx
const { session, createSession, loadSession } = useSession()

// Create new session
await createSession('Lecture 1')

// Load existing
await loadSession('session-uuid')
```

**Notes**

- Refreshes session list on mount
- Auto-saves before window unload
- Delegates to sessionStore actions

---

### useAccessibility

**Overview**

React hook for managing accessibility settings. Persists preferences to localStorage and applies CSS classes for high contrast mode.

**Parameters**

None - this is a parameterless hook.

**Return Value**

| Property | Type | Description |
|----------|------|-------------|
| `highContrast` | `boolean` | High contrast mode enabled |
| `autoDeleteAudio` | `boolean` | Auto-delete audio after transcription |
| `setHighContrast` | `(enabled: boolean) => void` | Set high contrast |
| `setAutoDeleteAudio` | `(enabled: boolean) => void` | Set auto-delete |
| `toggleHighContrast` | `() => void` | Toggle high contrast |
| `toggleAutoDeleteAudio` | `() => void` | Toggle auto-delete |

**Examples**

```tsx
const { highContrast, toggleHighContrast } = useAccessibility()

<Toggle checked={highContrast} onChange={toggleHighContrast} />
```

**Notes**

- Adds/removes `high-contrast` class on `document.documentElement`
- Persists to localStorage keys: `lecture-notes-high-contrast`, `lecture-notes-auto-delete-audio`

---

### useFocusTrap

**Overview**

React hook for trapping keyboard focus within a modal or dialog. Implements accessible focus management with focus restoration on close.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Whether the trap is active |

**Return Value**

| Type | Description |
|------|-------------|
| `RefObject<T>` | Ref to attach to the container element |

**Examples**

```tsx
const containerRef = useFocusTrap<HTMLDivElement>(isModalOpen)

<div ref={containerRef}>
  <button>First focusable</button>
  <input />
  <button>Last focusable</button>
</div>
```

**Notes**

- Focuses first focusable element on open (after 50ms delay for animations)
- Tab wraps from last to first element
- Shift+Tab wraps from first to last
- Restores focus to previously focused element on close
- Focusable selector: buttons, links, inputs, selects, textareas, `[tabindex]` (not -1)

---

## Stores

### sessionStore

**Overview**

Zustand store managing the core session state. Handles session CRUD, slide navigation, notes, transcripts, AI conversations, and UI state. Implements autosave with debouncing.

**State**

| Property | Type | Description |
|----------|------|-------------|
| `session` | `Session \| null` | Current session |
| `sessionList` | `SessionListItem[]` | Available sessions |
| `ui` | `UIState` | UI preferences |
| `isLoading` | `boolean` | Loading state |
| `isSaving` | `boolean` | Saving state |
| `error` | `SessionError` | Last error |

**Actions**

| Action | Signature | Description |
|--------|-----------|-------------|
| `createSession` | `(name?: string) => Promise<Session>` | Create and save new session |
| `loadSession` | `(sessionId: string) => Promise<void>` | Load session by ID |
| `saveSession` | `() => Promise<void>` | Save current session |
| `deleteSession` | `(sessionId: string) => Promise<void>` | Delete session |
| `refreshSessionList` | `() => Promise<void>` | Refresh session list |
| `setSlides` | `(slides: Slide[]) => void` | Replace slides |
| `setCurrentSlide` | `(index: number) => void` | Navigate to slide |
| `nextSlide` / `prevSlide` | `() => void` | Navigate slides |
| `updateNote` | `(slideId, content, plainText) => void` | Update note |
| `addTranscriptSegment` | `(slideId, segment) => void` | Add transcript |
| `setRecording` | `(isRecording: boolean) => void` | Set recording state |
| `setSessionPhase` | `(phase: SessionPhase) => void` | Set workflow phase |
| `setEnhancedNote` | `(slideId, note) => void` | Set enhanced note |
| `addAIMessage` | `(convId, message) => string` | Add AI message |
| `updateAIMessage` | `(convId, msgId, content) => void` | Update AI message |
| `setUIState` | `(updates: Partial<UIState>) => void` | Update UI state |
| `cleanup` | `() => void` | Clear timers/state |

**Examples**

```tsx
import { useSessionStore } from './stores/sessionStore'

// In component
const { session, setCurrentSlide } = useSessionStore()

// Outside component
const session = useSessionStore.getState().session
```

**Notes**

- Autosaves 3 seconds after changes (debounced)
- Validates and migrates sessions on load
- Tracks slide view times during recording
- Handles concurrent save requests gracefully

---

### notesStore

**Overview**

Zustand store for user notes and AI-enhanced notes. Provides CRUD operations keyed by slide ID.

**State**

| Property | Type | Description |
|----------|------|-------------|
| `notes` | `Record<string, Note>` | User notes by slideId |
| `enhancedNotes` | `Record<string, EnhancedNote>` | Enhanced notes by slideId |

**Actions**

| Action | Signature | Description |
|--------|-----------|-------------|
| `updateNote` | `(slideId, content, plainText) => void` | Create/update note |
| `getNote` | `(slideId) => Note \| null` | Get note |
| `deleteNote` | `(slideId) => void` | Delete note |
| `setEnhancedNote` | `(slideId, note) => void` | Set enhanced note |
| `updateEnhancedNoteStatus` | `(slideId, status, error?) => void` | Update status |
| `getEnhancedNote` | `(slideId) => EnhancedNote \| null` | Get enhanced note |
| `setNotes` | `(notes) => void` | Bulk set notes |
| `setEnhancedNotes` | `(notes) => void` | Bulk set enhanced |
| `reset` | `() => void` | Clear all |

---

### slideStore

**Overview**

Zustand store for slide data and navigation. Tracks slide viewing during recording.

**State**

| Property | Type | Description |
|----------|------|-------------|
| `slides` | `Slide[]` | Slide array |
| `currentSlideIndex` | `number` | Current index |

**Actions**

| Action | Signature | Description |
|--------|-----------|-------------|
| `setSlides` | `(slides) => void` | Replace slides |
| `setCurrentSlide` | `(index) => void` | Navigate |
| `nextSlide` / `prevSlide` | `() => void` | Navigate |
| `updateSlide` | `(slideId, updates) => void` | Update slide |
| `getCurrentSlide` | `() => Slide \| null` | Get current |
| `markSlideViewed` | `(index, timestamp) => void` | Mark viewed |
| `markSlideLeft` | `(index, timestamp) => void` | Mark left |
| `reset` | `() => void` | Clear |

---

### transcriptStore

**Overview**

Zustand store for transcript segments from audio transcription.

**State**

| Property | Type | Description |
|----------|------|-------------|
| `transcripts` | `Record<string, TranscriptSegment[]>` | Segments by slideId |

**Actions**

| Action | Signature | Description |
|--------|-----------|-------------|
| `addTranscriptSegment` | `(slideId, segment) => void` | Add segment |
| `getTranscriptsForSlide` | `(slideId) => TranscriptSegment[]` | Get for slide |
| `getAllTranscriptText` | `() => string` | Get all as text |
| `getTranscriptTextForSlide` | `(slideId) => string` | Get slide text |
| `setTranscripts` | `(transcripts) => void` | Bulk set |
| `clearTranscriptsForSlide` | `(slideId) => void` | Clear slide |
| `reset` | `() => void` | Clear all |

---

### toastStore

**Overview**

Zustand store for toast notifications with convenience methods.

**State**

| Property | Type | Description |
|----------|------|-------------|
| `toasts` | `ToastItem[]` | Active toasts |

**Actions**

| Action | Signature | Description |
|--------|-----------|-------------|
| `addToast` | `(toast) => string` | Add toast, returns ID |
| `removeToast` | `(id) => void` | Remove by ID |
| `clearAll` | `() => void` | Clear all |

**Convenience Functions**

```ts
import { toast } from './stores/toastStore'

toast.success('Title', 'Message', duration?)
toast.error('Title', 'Message', duration?)
toast.info('Title', 'Message', duration?)
toast.warning('Title', 'Message', duration?)
toast.shortcut('Action', 'Cmd+K')
```

---

## Libraries

### sessionValidator

**Overview**

Session data validation, recovery, and schema migration utilities. Ensures data integrity and backward compatibility.

**Functions**

#### `validateSession(data: unknown): ValidationResult`

Validates session data and attempts recovery.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | `unknown` | Yes | Session data to validate |

**Returns**: `{ valid: boolean, errors: string[], warnings: string[], recovered?: Session }`

#### `recoverSession(data: Record<string, unknown>): Session`

Recovers corrupted session by filling missing fields with defaults.

#### `migrateSession(data: Session): Session`

Migrates session to current schema version.

#### `createSessionBackup(session: Session): string`

Creates JSON backup string.

#### `restoreFromBackup(backupData: string): Session | null`

Restores session from backup.

**Constants**

- `CURRENT_SCHEMA_VERSION`: Current schema version (1)

**Examples**

```ts
const result = validateSession(loadedData)
if (result.warnings.length > 0) {
  console.warn('Validation warnings:', result.warnings)
}
const session = result.recovered || loadedData
```

---

### transcription

**Overview**

Helper functions for audio transcription with post-processing.

**Functions**

#### `transcribeAudioFile(audioBase64, slideId, addTranscriptSegment, options?)`

Transcribe audio and add segments to store.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `audioBase64` | `string` | Yes | Base64-encoded audio |
| `slideId` | `string` | Yes | Slide to associate with |
| `addTranscriptSegment` | `function` | Yes | Callback to add segment |
| `options` | `TranscriptionOptions` | No | Processing options |

**TranscriptionOptions**

```ts
interface TranscriptionOptions {
  slideText?: string        // For term correction
  verbosity?: VerbosityLevel // 'verbatim' | 'clean' | 'minimal'
  skipProcessing?: boolean   // Skip post-processing
}
```

**Returns**: `{ success: boolean, error?: string }`

---

### transcript-processor

**Overview**

Transcript post-processing pipeline: cleaning, term correction, and segmentation.

**Functions**

#### `cleanTranscript(text: string, options?: { verbosity?: VerbosityLevel }): string`

Remove filler words based on verbosity level.

- `verbatim`: No changes
- `clean`: Remove um, uh, er, ah, etc.
- `minimal`: Also remove "basically", "literally", phrases like "you know"

#### `correctTermsWithSlideContext(transcript: string, slideText?: string): string`

Correct technical terms using slide context. Handles:
- Common mishearings (sequel → SQL, jason → JSON)
- Acronym normalization (A.P.I. → API)
- Phonetic variations from slide terms

#### `segmentTranscript(segments: TranscriptSegment[], gapThresholdMs?: number): TranscriptSegment[]`

Merge segments into paragraphs based on time gaps.

#### `processTranscript(segments, slideText, config): TranscriptSegment[]`

Full pipeline: filter → clean → segment → correct.

**Examples**

```ts
const cleaned = cleanTranscript("Um, so basically the API...", { verbosity: 'clean' })
// "So the API..."

const corrected = correctTermsWithSlideContext("We use sequel for queries", "SQL Database")
// "We use SQL for queries"
```

---

### logger

**Overview**

Renderer process logger that bridges to main process for file logging.

**Functions**

#### `createLogger(source: string): RendererLogger`

Create a component-specific logger.

**RendererLogger Methods**

| Method | Signature | Description |
|--------|-----------|-------------|
| `debug` | `(message, data?) => void` | Debug level |
| `info` | `(message, data?) => void` | Info level |
| `warn` | `(message, data?) => void` | Warning level |
| `error` | `(message, error?) => void` | Error level |
| `child` | `(source) => RendererLogger` | Create child logger |

**Examples**

```ts
import { createLogger } from './lib/logger'

const log = createLogger('MyComponent')
log.info('Component mounted', { userId: 123 })
log.error('Failed to load', new Error('Network error'))
```

**Notes**

- Console output in development only
- Sends to main process via IPC for file logging
- Error objects serialized to `{ message, stack }`

---

### performance

**Overview**

Performance utilities: debounce, throttle, hooks, and memory management.

**Functions**

#### `debounce<T>(func: T, wait: number): T`

Debounce function calls.

#### `throttle<T>(func: T, limit: number): T`

Throttle function calls.

#### `useDebouncedCallback(callback, delay): function`

React hook for debounced callbacks.

#### `useThrottledCallback(callback, limit): function`

React hook for throttled callbacks.

#### `useRenderCount(componentName: string): void`

Development-only render counting.

#### `useCleanup(cleanup: () => void): void`

Guaranteed cleanup on unmount.

#### `revokeImageUrls(urls: string[]): void`

Revoke blob URLs to prevent memory leaks.

#### `lazyLoadImage(src: string): Promise<HTMLImageElement>`

Lazy load an image.

#### `useIntersectionObserver(callback, options?): RefCallback`

Hook for intersection-based lazy loading.

#### `requestIdleCallback(callback, options?): number`

Cross-browser idle callback.

#### `cancelIdleCallback(id: number): void`

Cancel idle callback.

#### `runDuringIdle<T>(work: () => T): Promise<T>`

Execute work during idle time.

---

## Prompts

### enhance-notes

**Overview**

Prompt templates for Granola-style note enhancement. Merges user notes with transcripts.

**Functions**

#### `getEnhanceSystemPrompt(): string`

Returns the system prompt defining enhancement behavior (~400 tokens).

#### `generateEnhancePrompt(context: EnhanceNotesContext): string`

Generate prompt for single slide enhancement.

**EnhanceNotesContext**

```ts
interface EnhanceNotesContext {
  slideText: string      // Extracted slide text
  slideIndex: number     // 1-based index
  totalSlides: number    // Total slides
  userNotes: string      // User's typed notes
  transcript: string     // Transcript for this slide
}
```

#### `generateLectureSummaryPrompt(slides): string`

Generate prompt for full lecture summary.

**Constants**

- `QUALITY_RUBRIC`: Scoring rubric for enhanced notes (preservation, conciseness, formatting, accuracy, studyValue)
- `ENHANCEMENT_EXAMPLES`: Before/after examples for testing

**Notes**

- Output limited to 150 words per slide
- Maximum 5 bullet points per section
- Preserves user's original points as priority
- Uses `[+]` marker for added critical points

---

### chat-prompts

**Overview**

AI chat prompts for contextual lecture assistance. Optimized for small models.

**Functions**

#### `getChatSystemPrompt(): string`

Returns system prompt for chat assistant.

#### `buildContextBlock(ctx: ChatContext): string`

Build structured context from lecture materials.

**ChatContext**

```ts
interface ChatContext {
  slideContent?: string
  slideIndex?: number
  totalSlides?: number
  userNotes?: string
  enhancedNotes?: string
  transcript?: string
  sessionName?: string
}
```

#### `buildFewShotSection(): string`

Build few-shot examples for first message.

#### `summarizeConversation(messages, maxMessages?): { summary, recentMessages }`

Summarize old messages to save tokens.

#### `buildChatPrompt(params): { systemPrompt, userPrompt }`

Build complete prompt for LLM.

#### `estimateTokens(text: string): number`

Rough token estimation (~4 chars/token).

#### `truncateContext(context, maxTokens?): ChatContext`

Truncate context to fit token budget.

---

## Types

### Core Types (`@shared/types`)

```ts
type SessionPhase = 
  | 'idle'              // No active session
  | 'recording'         // Capturing audio
  | 'processing'        // Finishing transcription
  | 'ready_to_enhance'  // Enhancement available
  | 'enhancing'         // AI enhancement in progress
  | 'enhanced'          // Enhancement complete
  | 'reviewing'         // User editing

interface Slide {
  id: string
  index: number
  imageData: string       // Base64 PNG
  width: number
  height: number
  extractedText?: string
  viewedAt?: number       // Recording timestamp
  viewedUntil?: number
}

interface Note {
  id: string
  slideId: string
  content: string         // HTML
  plainText: string
  createdAt: string
  updatedAt: string
}

interface EnhancedNote {
  id: string
  slideId: string
  content: string
  plainText: string
  originalNoteId?: string
  enhancedAt: string
  status: 'pending' | 'generating' | 'complete' | 'error' | 'accepted' | 'rejected'
  error?: string
}

interface TranscriptSegment {
  id: string
  slideId: string
  text: string
  startTime: number       // ms from session start
  endTime: number
  confidence: number
}

interface Session {
  id: string
  name: string
  pdfFileName?: string
  slides: Slide[]
  notes: Record<string, Note>
  enhancedNotes: Record<string, EnhancedNote>
  transcripts: Record<string, TranscriptSegment[]>
  aiConversations: AIConversation[]
  currentSlideIndex: number
  isRecording: boolean
  recordingStartTime?: number
  phase: SessionPhase
  feedback?: SessionFeedback
  totalRecordingDuration?: number
  createdAt: string
  updatedAt: string
  schemaVersion?: number
}

interface UIState {
  sidebarCollapsed: boolean
  transcriptPanelHeight: number
  notesPanelWidth: number
  showAIChat: boolean
  aiChatContext: 'current-slide' | 'all-slides' | 'all-notes'
  showExportModal: boolean
  showSettingsModal: boolean
  showShortcutsHelp: boolean
  showSearchModal: boolean
  showFeedbackModal: boolean
  showLiveTranscript: boolean
  showEnhancedNotes: boolean
  showSlideList: boolean
}
```

---

## Constants

### `@shared/constants`

```ts
// App info
APP_NAME = 'Lecture Note Companion'
APP_VERSION = '0.1.0'

// Audio recording
AUDIO_CONFIG = {
  SAMPLE_RATE: 16000,         // Whisper-compatible
  CHANNELS: 1,                // Mono
  BITS_PER_SAMPLE: 16,
  MIME_TYPE: 'audio/webm;codecs=opus',
  CHUNK_INTERVAL_MS: 5000,    // Real-time transcription chunks
}

// PDF processing
PDF_CONFIG = {
  MAX_SLIDE_WIDTH: 1920,
  MAX_SLIDE_HEIGHT: 1080,
  THUMBNAIL_WIDTH: 160,
  THUMBNAIL_HEIGHT: 90,
  SUPPORTED_FORMATS: ['pdf'],
}

// AI settings
AI_CONFIG = {
  MAX_CONTEXT_LENGTH: 4096,
  MAX_RESPONSE_LENGTH: 2048,
  TEMPERATURE: 0.7,
  CONTEXT_TYPES: ['current-slide', 'all-slides', 'all-notes'],
}

// Transcription
TRANSCRIPTION_CONFIG = {
  CONFIDENCE_THRESHOLD: 0.5,
  LOW_CONFIDENCE_THRESHOLD: 0.8,
  MIN_CHUNK_DURATION_MS: 2000,
  POST_PROCESSING: {
    DEFAULT_VERBOSITY: 'clean',
    PARAGRAPH_GAP_MS: 5000,
    USE_SLIDE_CONTEXT: true,
  },
}

// UI defaults
UI_DEFAULTS = {
  SIDEBAR_WIDTH: 200,
  NOTES_PANEL_WIDTH: 350,
  TRANSCRIPT_PANEL_HEIGHT: 200,
  MIN_PANEL_SIZE: 150,
  MAX_PANEL_SIZE: 600,
}

// Keyboard shortcuts
SHORTCUTS = {
  NEXT_SLIDE: 'ArrowRight',
  PREV_SLIDE: 'ArrowLeft',
  TOGGLE_RECORDING: 'r',
  TOGGLE_AI_CHAT: 'a',
  FOCUS_NOTES: 'n',
  SAVE: 'Meta+s',
  EXPORT: 'Meta+e',
  IMPORT_PDF: 'Meta+o',
  NEW_SESSION: 'Meta+n',
  SETTINGS: 'Meta+,',
  TOGGLE_SIDEBAR: 'Meta+\\',
}

// Autosave
AUTOSAVE_INTERVAL_MS = 3000
```

---

*Generated from source code analysis. Last updated: 2026-02-01*

