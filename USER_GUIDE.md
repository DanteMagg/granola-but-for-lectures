# Lecture Note Companion - User Guide

A privacy-first note-taking app for lectures with live transcription and AI assistance. Everything runs locally on your device.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Importing Lecture Slides](#importing-lecture-slides)
3. [Taking Notes](#taking-notes)
4. [Recording & Transcription](#recording--transcription)
5. [AI-Enhanced Notes](#ai-enhanced-notes)
6. [AI Chat Assistant](#ai-chat-assistant)
7. [Search](#search)
8. [Exporting Your Notes](#exporting-your-notes)
9. [Settings & AI Models](#settings--ai-models)
10. [Keyboard Shortcuts](#keyboard-shortcuts)
11. [Privacy & Data Storage](#privacy--data-storage)
12. [Tips for Best Results](#tips-for-best-results)
13. [Troubleshooting](#troubleshooting)

---

## Getting Started

When you first open Lecture Note Companion, you'll see a welcome screen explaining the app's privacy-first approach.

### First-Time Setup

1. **Welcome screen** - Read about privacy features, then click **Get Started**
2. **Quick tour** - Walk through the 3-step workflow: Import → Record → Enhance
3. **Download AI models** - Go to Settings to download transcription and AI chat models

[Screenshot: Welcome screen with privacy information]

> 💡 **Tip:** The app works without AI models, but you'll need them for transcription and AI features.

---

## Importing Lecture Slides

### How to Import a PDF

1. Click **Import PDF** in the center of the screen (or the header if you have a session open)
2. Select your lecture slides PDF
3. Wait for processing — the app extracts each page as a slide

[Screenshot: Empty state with Import PDF button]

**Or use the keyboard shortcut:** `⌘O` (Mac) / `Ctrl+O` (Windows)

### What Happens During Import

- Each PDF page becomes a navigable slide
- Text is extracted from slides for search functionality
- Thumbnails are generated for the slide list

### Supported Formats
- PDF files only (`.pdf`)
- Works best with presentation-style PDFs (PowerPoint exports, Keynote exports, etc.)

> 💡 **Tip:** For best results, export your slides to PDF at high quality before importing.

---

## Taking Notes

Notes are organized per-slide. Each slide has its own note area that saves automatically.

### The Notes Panel

The notes panel appears on the right side when you have slides loaded.

[Screenshot: Notes panel with formatting toolbar]

### Formatting Options

| Button | Action | Shortcut |
|--------|--------|----------|
| **B** | Bold text | `⌘B` / `Ctrl+B` |
| *I* | Italic text | `⌘I` / `Ctrl+I` |
| • | Bullet list | — |
| 1. | Numbered list | — |
| ↶ | Undo | `⌘Z` / `Ctrl+Z` |
| ↷ | Redo | `⌘⇧Z` / `Ctrl+Shift+Z` |

### Auto-Save

Your notes save automatically as you type. You'll see:
- **"Saving..."** - Currently saving
- **"✓ Saved"** - All changes saved

> 💡 **Tip:** Press `N` to quickly focus the notes editor from anywhere in the app.

---

## Recording & Transcription

Record your lecture and get real-time transcription — all processed locally on your device.

### Before You Start Recording

1. **Download a Whisper model** (Settings → AI Models)
   - Recommended: "small" for classroom settings
   - "tiny" for quick tests, "medium" for noisy environments
2. Grant microphone permission when prompted

### How to Record

1. Navigate to the slide you're starting from
2. Click the **microphone button** (or press `R`)
3. A red recording indicator appears with a timer
4. Navigate slides as the lecture progresses — transcripts link to each slide

[Screenshot: Recording controls with audio visualization]

### During Recording

- **Audio visualizer** shows input level
- **Pause button** to temporarily stop recording
- **Live transcript toggle** shows/hides real-time transcription
- **Green dot** indicates Whisper is active

### Stopping Recording

1. Click the **stop button** (square icon) or press `R`
2. Wait for final transcription processing
3. You'll be prompted to provide feedback (optional)

### Transcription Quality Tips

- Position your laptop/microphone close to the speaker
- "Small" or "medium" Whisper models work best for classroom audio
- If you see a low audio warning, move closer to the sound source

> ⚠️ **Warning:** If you see "Whisper not loaded," go to Settings → AI Models to download and load a model.

---

## AI-Enhanced Notes

After recording, AI can merge your handwritten notes with the lecture transcript to create comprehensive study notes.

### When Enhancement is Available

After you stop recording, you'll see an **"Enhance Notes"** button. This appears in two places:
- Below the slide viewer (prominent call-to-action)
- In the notes panel header (compact button)

[Screenshot: Enhance Notes button after recording]

### How to Enhance Notes

1. Stop your recording
2. Wait for the "Ready to Enhance" state
3. Click **"Enhance All Notes"**
4. Watch the progress bar as each slide is processed

### Viewing Enhanced Notes

In the Notes panel:
1. Click the **"Enhanced"** tab
2. Compare with your **"Original"** notes
3. Accept ✓ or reject ✗ enhanced versions

[Screenshot: Original vs Enhanced notes tabs]

### What Enhancement Does

- Combines your bullet points with full transcript context
- Organizes information into clear sections
- Preserves your key points while adding detail
- Creates study-ready formatted notes

> 💡 **Tip:** Enhancement works best when you've taken some notes AND have transcript data.

---

## AI Chat Assistant

Ask questions about your lecture content using a local AI model.

### Opening AI Chat

- Press `A` on your keyboard
- Or click the AI/sparkle icon in the header

[Screenshot: AI Chat modal]

### Chat Context Options

Choose what the AI knows about:

| Context | What's Included |
|---------|-----------------|
| **Current Slide** | Current slide text, your notes, transcript for this slide |
| **All Slides** | Full lecture content across all slides |
| **All Notes** | Just your notes from all slides |

Click the **Context** dropdown to switch between these.

### Quick Actions

When you open the chat, you'll see quick action buttons:

- **Explain this slide** - Get a plain-language explanation
- **Quiz me** - Generate practice questions with answers
- **Summarize lecture** - Get a full lecture summary (uses All Slides context)

### Typing Your Own Questions

Examples of what you can ask:
- "What's the relationship between X and Y on this slide?"
- "Can you explain [concept] in simpler terms?"
- "What are the key takeaways from today's lecture?"
- "Create a study outline for this material"

### Response Features

- **Copy button** - Copy any AI response to clipboard
- **Stop generating** - Cancel a response in progress
- **Streaming** - See responses as they're generated

> ⚠️ **Note:** If you see "No model installed," go to Settings → AI Models to download an LLM model.

---

## Search

Find anything across your slides, notes, and transcripts.

### Opening Search

- Press `⌘K` or `⌘F` (Mac) / `Ctrl+K` or `Ctrl+F` (Windows)
- Or use the menu

[Screenshot: Search modal]

### Search Results

Results are color-coded by type:
- 📄 **Slides** - Text from slide content (gray)
- 💬 **Notes** - Your handwritten notes (blue)
- ✨ **Enhanced** - AI-enhanced notes (amber)
- 🎤 **Transcripts** - Recorded audio transcription (green)

### Filtering Results

Click the filter buttons to show only:
- All results
- Slides only
- Notes only
- Enhanced notes only
- Transcripts only

### Navigating Results

- Use `↑` `↓` arrow keys to navigate
- Press `Enter` to go to that slide
- Press `Esc` to close search

---

## Exporting Your Notes

Export your session to PDF or Markdown for studying or sharing.

### Opening Export

- Press `⌘E` (Mac) / `Ctrl+E` (Windows)
- Or click Export in the header menu

[Screenshot: Export modal]

### Export Format

Choose between:
- **PDF Document** - Formatted PDF with slide images
- **Markdown** - Plain text `.md` file

### Content Options

Select what to include:
- ☑️ **Slide Images** - Visual slide thumbnails
- ☑️ **Notes** - Your handwritten notes
  - Option: Use enhanced notes when available
- ☑️ **Transcripts** - Audio transcription text

### Slide Range

- **All Slides** - Export everything
- **Current Slide** - Just the one you're viewing
- **Custom Range** - Specify slide numbers (e.g., 5-15)

### Preview

Click the **eye icon** to preview your export before saving.

---

## Settings & AI Models

Configure the app and download AI models.

### Opening Settings

- Press `⌘,` (Mac) / `Ctrl+,` (Windows)
- Or click the gear icon

### AI Models Tab

[Screenshot: Settings AI Models tab]

#### Whisper (Speech-to-Text)

| Model | Size | Best For |
|-------|------|----------|
| tiny | 75 MB | Quick tests, clear audio close to mic |
| base | 142 MB | Good balance of speed and accuracy |
| **small** ⭐ | 466 MB | **Recommended for classrooms** |
| medium | 1.5 GB | Noisy environments, distant audio |

Models ending in `.en` are English-only (slightly faster).

#### LLM (AI Assistant)

| Model | Size | Notes |
|-------|------|-------|
| tinyllama-1.1b | 670 MB | Fastest, basic quality |
| phi-2 | 1.6 GB | Good balance |
| llama-3.2-1b | 775 MB | Newer architecture |
| llama-3.2-3b | 2.0 GB | Better quality |
| mistral-7b-instruct | 4.4 GB | Best quality |

### Downloading Models

1. Select a model from the dropdown
2. Click **Download**
3. Wait for download to complete (progress bar shown)
4. Model loads automatically

> 💡 **Tip:** Start with "small" Whisper and "tinyllama-1.1b" LLM. Upgrade later if needed.

### Accessibility Tab

- **High Contrast Mode** - Increases contrast for better readability
- **Auto-delete Audio Files** - Removes recordings after transcription (saves space)

### Storage Tab

- View data storage location
- View and export debug logs
- See downloaded models

### About Tab

App version information and quick keyboard reference.

---

## Keyboard Shortcuts

### Navigation

| Shortcut | Action |
|----------|--------|
| `←` | Previous slide |
| `→` | Next slide |
| `?` | Show all shortcuts |

### Recording & AI

| Shortcut | Action |
|----------|--------|
| `R` | Start/stop recording |
| `A` | Open/close AI chat |
| `N` | Focus notes editor |

### File Operations

| Shortcut | Action |
|----------|--------|
| `⌘O` | Import PDF |
| `⌘N` | New session |
| `⌘S` | Save session |
| `⌘E` | Export |

### Search & Interface

| Shortcut | Action |
|----------|--------|
| `⌘K` or `⌘F` | Open search |
| `⌘\` | Toggle sidebar |
| `⌘,` | Open settings |
| `Esc` | Close modal/dialog |

---

## Privacy & Data Storage

### What Stays on Your Device

✅ **Everything:**
- Lecture slides (PDF images)
- Your notes
- Audio recordings
- Transcripts
- AI conversations
- Enhanced notes
- Settings and preferences

### What's Never Sent Online

- No cloud sync
- No analytics
- No account required
- AI models run 100% locally

### Data Location

Your data is stored in:
```
~/Library/Application Support/Lecture Note Companion/
```

### Audio File Privacy

Enable **Auto-delete Audio Files** in Settings → Accessibility to automatically remove recordings after transcription.

---

## Tips for Best Results

### Recording Quality

1. **Position matters** - Sit near the front or close to speakers
2. **Use "small" or "medium" Whisper models** for classroom settings
3. **Check the audio visualizer** - Make sure it's detecting sound
4. **Avoid covering the mic** on your laptop

### Taking Notes

1. **Don't transcribe manually** - Let Whisper do it, focus on key points
2. **Use bullet points** - AI enhancement works better with structured notes
3. **Note slide numbers** for complex topics you want to review

### AI Enhancement

1. **Record first, enhance after** - Enhancement uses transcript data
2. **Both notes AND transcript** make the best enhanced notes
3. **Review enhanced notes** - Accept or regenerate as needed

### Organization

1. **Name sessions clearly** - "CS101 Lecture 5 - Algorithms"
2. **One session per lecture** - Keeps everything organized
3. **Export important lectures** to PDF for offline study

---

## Troubleshooting

### "Whisper not loaded" Warning

**Problem:** Transcription won't work.

**Solution:**
1. Go to Settings → AI Models
2. Download a Whisper model (recommend "small")
3. Wait for download to complete
4. Click "Load" if it doesn't auto-load

### No Audio Being Detected

**Problem:** Recording starts but no sound is picked up.

**Solutions:**
1. Check that you've granted microphone permission
2. Make sure your mic isn't muted in system settings
3. Try a different microphone if available
4. Check if another app is using the microphone

### AI Chat Shows "No model installed"

**Problem:** Can't use AI assistant.

**Solution:**
1. Go to Settings → AI Models
2. Scroll to "Local LLM" section
3. Download a model (recommend "tinyllama-1.1b" to start)
4. Wait for download and load

### Enhancement Not Working

**Problem:** Enhanced notes show errors or nothing happens.

**Solutions:**
1. Make sure an LLM model is downloaded and loaded
2. Check you have notes OR transcript content (ideally both)
3. Try enhancing individual slides instead of all at once
4. Check Settings for any error messages

### Transcription Quality is Poor

**Problem:** Transcript has many errors.

**Solutions:**
1. Try a larger Whisper model ("small" or "medium")
2. Move closer to the audio source
3. Record in a quieter environment
4. Check if audio level visualization shows signal

### App Running Slowly

**Problem:** Everything feels laggy.

**Solutions:**
1. Use smaller AI models if you have limited RAM
2. Close other resource-heavy applications
3. For very long lectures, consider breaking into multiple sessions
4. Enable "Auto-delete Audio Files" to save disk space

### Can't Import PDF

**Problem:** PDF won't load or shows errors.

**Solutions:**
1. Make sure the file is a valid PDF
2. Try a smaller PDF if the file is very large
3. Re-export from the original presentation software
4. Check if the PDF is password-protected (not supported)

---

## Getting Help

If you encounter issues not covered here:

1. Check Settings → Storage → Debug Logs for error details
2. Copy logs and include when reporting issues
3. Note your system specs and which AI models you're using

---

*Lecture Note Companion v0.1.0 • Built with privacy in mind*

