# Lecture Note Companion

A privacy-first, local-only desktop app for students to take notes synchronized with PDF lecture slides, with live transcription and AI assistance.

## Features

- **PDF Slide Import**: Import lecture PDFs and navigate through slides
- **Synchronized Note-Taking**: Take rich-text notes linked to each slide
- **Live Transcription**: Record lecture audio with real-time transcription (Whisper integration)
- **AI Assistant**: Get contextual help understanding lecture content (local LLM)
- **100% Private**: All data stays on your device - no cloud required
- **Session Export**: Export your notes, slides, and transcripts to PDF

## Tech Stack

- **Electron** - Cross-platform desktop app
- **React + TypeScript** - UI framework
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Tiptap** - Rich text editor
- **PDF.js** - PDF rendering
- **Whisper.cpp** - Speech-to-text (planned)
- **llama.cpp** - Local LLM (planned)

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Building

```bash
# Build for production
npm run build
```

## Project Structure

```
src/
├── main/           # Electron main process
├── renderer/       # React application
│   ├── components/ # UI components
│   ├── hooks/      # Custom React hooks
│   └── stores/     # Zustand stores
├── shared/         # Shared types and constants
└── preload.ts      # Electron preload script
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `←` `→` | Navigate slides |
| `A` | Open AI chat |
| `R` | Toggle recording |
| `⌘/Ctrl + S` | Save session |
| `⌘/Ctrl + E` | Export session |

## Privacy

All your data is stored locally on your device:
- Sessions are saved in your user data folder
- Audio recordings are stored locally and can be auto-deleted
- No data is sent to external servers
- AI runs completely offline using local models

## License

MIT

