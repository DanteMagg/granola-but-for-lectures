# Lecture Note Companion – Local-First Desktop Prototype PRD

---

### TL;DR

Lecture Note Companion is a privacy-first, local-only desktop (Electron-style) app for college students and TAs. Users import PDF slides, record and transcribe live lecture audio (optimized for distant speakers), take organized notes mapped to each slide, and get contextual AI help—all data stays fully local. The prototype is scoped for feasibility, speed, and robust production-minded architecture, prioritizing clear modularity, local processing, and focused UI for efficient user testing.

---

## Goals

### Business Goals

* **Target Launch:** Functional desktop prototype (Electron) in 4 weeks.

* **Adoption:** 100+ student users in first semester, via local outreach.

* **Demonstration:** Prove accurate, private, local-first transcription and AI interaction for academic note-taking.

* **Iteration:** Fast feedback integration and institutional engagement.

### User Goals

* Seamless per-slide PDF import, live audio transcription, and note-taking.

* All data (slides, notes, audio/transcript, AI outputs) remains on the user’s device.

* Powerful per-slide search, review, and contextual AI help.

* Zero dependencies on cloud for core experience.

### Non-Goals

* No live video features, no cloud processing by default. K-12 use is out-of-scope.

---

## Core Features, Technical Architecture & Data Flow

### Overview Table

Assumptions for Prototype

* All modules communicate via local IPC/native APIs within Electron.

* All data is serialized in local JSON files per session in app’s user data folder.

* AI and STT models are pre-bundled small versions (e.g., Whisper Small, DistilGPT), limited for feasibility.

* PDF parsing is slide-image plus basic text extraction only—no advanced OCR/annotation yet.

* UI prioritizes functional clarity over full visual polish—minimal reskinning.

* No user authentication, cloud sync, or multi-device support; strictly single-user local prototype.

---

### Feature Details, Technical Modules, and Data Mapping

1\. **PDF Import & Slide Parsing**

* **Modules/Classes:**

  * `PDFImporter.js`: Handles file input, integrity checking, and initial processing queue.

  * `SlideParser.js`: Splits PDF into slide images and extracts slide titles/text.

* **Data Flow:**

  * User selects PDF → `PDFImporter` loads file → `SlideParser` splits into per-slide JPEG/PNG + extracts titles → Writes slide meta in `sessionStore.json`.

* **Data Storage:**

  * All slide images/text stored in session-local folder; session index in `sessionStore.json`.

* **UI:**

  * Drag-and-drop/file picker for PDF.

  * Visual import progress.

  * Slide thumbnail scroller for confirmation.

2\. **Live Audio Transcription (Local, Real-Time)**

* **Modules/Classes:**

  * `AudioRecorder.js`: Interfaces with OS audio API; records buffered PCM streams.

  * `STTEngine.js`: Integrates local speech-to-text model (e.g., Whisper.cpp, Node bindings).

* **Data Flow:**

  * On user hitting "Record," `AudioRecorder` streams audio → processed in batches to `STTEngine` → real-time transcript emits → temporary local .wav + updates `transcripts.json` per current slide.

  * Continuous error state monitoring (e.g., no mic, noise level).

* **Data Storage:**

  * Temp audio files deleted on session close (configurable for privacy).

  * Raw and processed transcripts saved in per-session transcription index.

* **UI:**

  * Microphone permission prompt.

  * Large "Record" toggle button.

  * Live transcript panel (per slide).

  * Audio waveform/level meter.

3\. **Slide Sync (Automatic/Manual Context Binding)**

* **Modules/Classes:**

  * `SessionController.js`: Tracks current slide, syncs context for notes/transcription.

  * `SlideNavigation.js`: Keyboard/mouse event mapping for slide switching.

* **Data Flow:**

  * User, or (optionally) embedded slide cue, triggers slide change → updates active context, notifies all UI modules → binds new notes/transcript to current slide in state.

* **Data Storage:**

  * Context indices (`sessionStore.json`) reference notes/transcript objects keyed by slide UUID.

* **UI:**

  * Next/Prev slide buttons.

  * Slide number indicator.

  * Active slide highlighting in thumbnail list.

  * Keyboard shortcut hints.

4\. **Note Overlay (Per-Slide Editing)**

* **Modules/Classes:**

  * `NotesPanel.js`: Text editor widget, links to session state.

  * `NoteModel.js`: Manages CRUD for notes; auto-saves on change.

* **Data Flow:**

  * User types/edits text → controlled component → persists to `notes.json` with active slide reference.

  * Syncs with undo/redo stack on per-slide basis.

* **Data Storage:**

  * `notes.json` maps notes to slide IDs, includes timestamps and optional rich text metadata.

* **UI:**

  * Persistent, resizable note panel beside slide preview.

  * Lightweight rich text controls (bold, list) minimally enabled.

  * Undo/redo, auto-save indicators.

5\. **Contextual AI Chatbot (Local Model Integration)**

* **Modules/Classes:**

  * `LocalAIBridge.js`: Spins up lightweight local LLM in subprocess.

  * `AIWorker.js`: Handles all UI-to-LLM task routing, query pre/post-processing.

* **Data Flow:**

  * User opens "Ask AI" modal, selects context (current slide, whole session) → data piped to `LocalAIBridge` → processed by local LLM → formatted response appears in overlay.

* **Data Storage:**

  * Queries, contexts, and responses stored in `ai-queries.json` for session recall/history.

* **UI:**

  * "Ask AI" floating button.

  * Modal overlay chat with context selection dropdown.

  * Display of streaming responses; error/capacity handling.

6\. **Session Export (Unified Output)**

* **Modules/Classes:**

  * `Exporter.js`: Gathers all session data, packages into PDF (e.g., using `pdfkit`).

* **Data Flow:**

  * User clicks "Export," picks format → `Exporter` reads slide images, notes, transcripts → generates output file on user’s device.

* **Data Storage:**

  * No persistent cloud—output written to user-configured local path, nothing automatically uploaded.

* **UI:**

  * Export menu: choice of slides/notes/transcript inclusion.

  * Export progress and completion feedback.

---

## User Experience & Interface – Actionable Prototype Detail

### Onboarding & Entry

* One-click install (Electron app, all dependencies bundled).

* On first launch: privacy statement modal (local-only), 3-step tour with images ("Import Slides" → "Record & Take Notes" → "Ask AI/Export").

* Default path prompt for local storage location (with change option).

### Core Session Workflow

1. **Import Slides**

  * Large, central area for "Import PDF" (drag/drop + file picker).

  * Slide preview strip appears; each slide shown as thumbnail; user can scroll and select.

2. **Begin Lecture Session**

  * "Start Session" visible when PDF imported. Brings up side-by-side split: Slide → Notes → Transcript.

  * "Record" prominent: state (Recording/Not Recording), color feedback on status.

3. **Active Note-Taking**

  * Live transcript appears below notes; both input areas persistently visible, resizable.

  * Notes auto-linked to slide, badge shows when note/transcript exist for current slide.

  * Notes area: supports rich text (bold, lists, highlight), single-level undo/redo for prototype.

4. **Slide Navigation**

  * Next/Prev arrow buttons below slide; thumbnail sidebar or keyboard shortcuts enabled.

  * Active slide visually high-contrast; context refreshes in Notes and Transcription zones on change.

5. **AI Chatbot**

  * Floating "Ask AI" button opens overlay modal; context set to (Current Slide/All Slides/All Notes).

  * User input box; streaming AI replies; error banner for overload/timeouts.

  * Collapsible chat history for session.

6. **Session Review & Export**

  * After "Stop Recording," session review mode is enabled.

  * Users flip through slides; see all notes/transcripts per slide.

  * "Export" options: All/Selected Slides; PDF output to local folder.

  * Session-rated using modal, then summary and feedback prompt.

### Error States & Accessibility

* Failure-to-import PDF: Modal with retry and "Report error" action.

* Microphone access denied/unavailable: Persistent banner, troubleshooting CTA.

* Transcription or AI engine overloaded: In-context error message; disables further actions until resolved.

* High-contrast toggle, keyboard navigation, all elements accessible by screen reader.

---

## Implementation & Delivery Scope

### Production-Minded, Prototype-First

* **Single desktop binary**, all data in local hidden folder (e.g., `%APPDATA%/LectureNoteCompanion/`), no remote API or server dependencies.

* All model inference (speech, LLM) runs in local sub-processes, minimal memory profile for test hardware.

* Modular code structure: Each module self-contained, IPC for communication.

* Minimal UI styling—focus on layout, clear labeling, and interactive responsiveness.

* Exception and log files locally for troubleshooting (user can export/send if needed).

### Prototype Limitations vs. Full Product

* Models limited in size (trading accuracy for performance); upgradable in final build.

* No advanced multi-user features or authentication.

* No cloud sync, institutional SSO, or real-time collaborative features.

* Export minimal: PDF with basic slide/notes formatting, no advanced styling.

### Next Steps Upon Success

* Upgrade models, UI polish for full-scale release.

* Add import/export enhancements, cloud options, and institutional integration.

---

## Milestones & Phasing

1. **Day 1-3:** Module scaffolding + PDF & audio pipeline validation.

2. **Day 4-7:** Full data flow wiring (PDF import, basic audio recording, per-slide hooks), placeholder UI.

3. **Day 8-15:** End-to-end flow (PDF import → record/transcribe → per-slide notes → AI Q&A → export).

4. **Day 16-21:** Polish edge cases, accessibility, minimal style passes, internal QA.

5. **Day 22-28:** Seed closed test; rapid bugfix; document code and feedback forms.

---

## Success Metrics

* All features testable on offline student laptops (minimum 2018 Intel i5/8GB RAM).

* 100% local session data persistence and cleanup.

* Live transcription <10% WER in sample lecture environments.

* Session export reliability >98%, no unsaved data loss in normal flows.

* 

> 80% positive feedback from initial test cohort on usability and privacy.

---

## Appendix: Key Decisions & Assumptions (Prototype Phase)

* No optional cloud features in MVP—core use case is local, private.

* LLM and STT modules sized for offline use—accuracy prioritized within device limits.

* UI/UX structure and workflows designed for realistic lecture use, but with prototype visuals.

* User bug/crash logs are local-only and opt-in for export.

* No K-12, no advanced PDF annotation/OCR, no enterprise authentication.

---