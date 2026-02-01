# Immediate Improvement Tasks

Run these prompts to systematically improve the Lecture Note Companion. Each produces actionable output.

---

## 1. 🎯 AI Chat Enhancement

**Goal**: Improve the AI chatbot to give better, more contextual responses

```
You are improving an AI chat feature in a lecture note-taking app. The chat uses a local TinyLlama model via node-llama-cpp.

Current issues:
- Responses can be generic
- Context from slides/notes not used effectively
- No memory between messages in some cases

<current_prompt_construction>
Look at AIChatModal.tsx and useLocalAI.ts to understand how prompts are built
</current_prompt_construction>

Improve the system prompt and context injection:
1. Create a better system prompt that explains the app's purpose
2. Design context format that includes: current slide text, user notes, recent transcript
3. Add few-shot examples of good Q&A about lecture content
4. Implement conversation summarization for long chats

Provide:
- New system prompt (< 500 tokens)
- Context template with placeholders
- 3 few-shot examples
- Code changes needed
```

---

## 2. 📝 Note Enhancement Quality

**Goal**: Make the AI note enhancement produce higher quality merged notes

```
You are optimizing the note enhancement feature that merges user notes with lecture transcripts.

<current_approach>
The app sends slide content + user notes + transcript to LLM and asks for enhanced notes.
</current_approach>

Problems:
- Output can be too verbose
- Sometimes loses user's original key points
- Doesn't maintain consistent formatting

Design a better enhancement prompt:
1. System prompt that defines the enhancement task precisely
2. Output format specification (headers, bullets, key terms)
3. Rules for preserving user intent while adding transcript context
4. Examples of good enhancement (before/after)

Deliverables:
- New prompt template
- Output schema/format specification
- 2 before/after examples
- Quality scoring rubric
```

---

## 3. 🔊 Transcription Accuracy

**Goal**: Improve transcription post-processing

```
You are improving the transcription pipeline that uses Whisper for speech-to-text.

<current_flow>
Audio chunks → Whisper → Raw transcript segments → Displayed in UI
</current_flow>

Problems:
- Filler words clutter transcripts ("um", "uh", "like")
- No speaker separation
- Technical terms often misheard
- Timestamps can drift

Design improvements:
1. Post-processing pipeline to clean transcripts
2. Confidence-based filtering strategy
3. Slide context injection to improve technical term accuracy
4. Segmentation logic for better paragraph breaks

Provide:
- Transcript cleaning function (TypeScript)
- Configuration for different verbosity levels
- Strategy for using slide text to correct terms
```

---

## 4. 🎨 UI Polish Pass

**Goal**: Make the UI feel more polished and professional

```
You are a UI designer doing a polish pass on a lecture note-taking app.

<component_inventory>
- SlideViewer: Shows current slide, navigation
- NotesPanel: Tiptap editor for notes
- TranscriptPanel: Live/recorded transcript
- AudioRecorder: Recording controls
- AIChatModal: AI assistant
- Sidebar: Session list
- Header: App title, actions
</component_inventory>

For each component, suggest:
1. Micro-interactions to add (hover states, transitions)
2. Visual feedback improvements (loading, success, error)
3. Spacing/typography refinements
4. Color/contrast adjustments
5. Animation opportunities (subtle, purposeful)

Prioritize changes that:
- Take < 30 min to implement each
- Have high visual impact
- Don't require new dependencies

Output as a checklist with CSS/JSX snippets.
```

---

## 5. ⌨️ Keyboard Navigation Audit

**Goal**: Ensure full keyboard accessibility

```
You are auditing keyboard navigation for a desktop app.

<features_to_navigate>
1. Switch between slides
2. Start/stop recording
3. Open AI chat
4. Edit notes
5. Search content
6. Export session
7. Switch sessions
8. Access settings
</features_to_navigate>

<current_shortcuts>
Arrow keys: Navigate slides
R: Toggle recording
A: Toggle AI chat
Cmd+S: Save
Cmd+E: Export
Cmd+K: Search
?: Show shortcuts
</current_shortcuts>

Audit:
1. Can all features be reached by keyboard?
2. Is focus order logical?
3. Are focus indicators visible?
4. Are there keyboard traps?
5. Do modals trap focus correctly?

Provide:
- Gap analysis (what's missing)
- Recommended new shortcuts
- Focus management fixes needed
- Tab order corrections
```

---

## 6. 🧪 Test Coverage Expansion

**Goal**: Identify and fill testing gaps

```
You are expanding test coverage for critical features.

<high_risk_areas>
1. PDF import and slide parsing
2. Audio recording and chunking
3. Whisper transcription integration
4. Session save/load/migrate
5. AI chat streaming responses
6. Note enhancement workflow
</high_risk_areas>

For each area:
1. List edge cases not currently tested
2. Identify integration points that need tests
3. Suggest error scenarios to cover
4. Provide test code skeletons

Focus on tests that:
- Catch real bugs (not just coverage)
- Test user-facing behavior
- Handle async properly
- Mock external dependencies correctly
```

---

## 7. 🚀 Performance Profiling

**Goal**: Identify and fix performance bottlenecks

```
You are profiling performance in an Electron + React app.

<known_heavy_operations>
1. PDF parsing (PDF.js)
2. Image rendering (base64 slides)
3. Transcription (Whisper)
4. LLM inference (node-llama-cpp)
5. Rich text editing (Tiptap)
6. State updates (Zustand)
</known_heavy_operations>

<symptoms_reported>
- UI freezes during PDF import
- Memory grows during long recordings
- Typing lag in notes editor with many slides
</symptoms_reported>

For each area:
1. Identify the likely cause
2. Suggest measurement approach
3. Propose optimization (with code)
4. Estimate impact

Prioritize by:
- User-perceived performance
- Frequency of the operation
- Ease of fix
```

---

## 8. 🔒 Security Hardening

**Goal**: Close security gaps in the Electron app

```
You are hardening security for an Electron app.

<threat_model>
- App handles user's lecture notes (sensitive academic content)
- Downloads AI models from Hugging Face
- Processes arbitrary PDF files
- Records audio from microphone
- Stores data in local filesystem
</threat_model>

<current_architecture>
- contextIsolation: true
- nodeIntegration: false
- IPC via preload script
- Session data stored as JSON
</current_architecture>

Review and harden:
1. IPC channel security (validation, allowlist)
2. File path sanitization
3. PDF parsing safety
4. Download integrity verification
5. Content Security Policy
6. Sensitive data handling

Provide:
- Security checklist
- Code fixes for any gaps
- Configuration changes needed
- Audit logging recommendations
```

---

## 9. 📱 Responsive Layout

**Goal**: Make UI work well at different window sizes

```
You are making a desktop app responsive to window resizing.

<breakpoints_needed>
- Full size (1920x1080+): All panels visible
- Medium (1280x800): Collapsible sidebar
- Compact (1024x768): Single panel focus mode
- Minimum (800x600): Essential features only
</breakpoints_needed>

<current_layout>
Sidebar | SlideViewer | NotesPanel
         TranscriptPanel
</current_layout>

Design responsive behavior:
1. What hides/collapses at each breakpoint?
2. How do panels resize?
3. What's the minimum viable layout?
4. How to switch between layouts?

Provide:
- CSS/Tailwind breakpoint classes
- Component visibility logic
- Resize handle implementation
- Mobile-style navigation for small screens
```

---

## 10. 📚 Documentation Generation

**Goal**: Generate comprehensive developer documentation

```
You are writing developer documentation for the Lecture Note Companion codebase.

<documentation_needed>
1. Architecture overview
2. Component API reference
3. State management guide
4. IPC protocol documentation
5. AI integration guide
6. Testing guide
7. Contributing guide
</documentation_needed>

For each section:
1. Outline the structure
2. Identify code that needs documenting
3. Write the documentation
4. Add diagrams where helpful

Style:
- Technical but approachable
- Include code examples
- Link to relevant source files
- Explain the "why" not just "what"
```

---

## Running Order Recommendation

For maximum impact, run these in order:

1. **Security Hardening** (#8) - Fix risks first
2. **Performance Profiling** (#7) - Remove blockers
3. **Keyboard Navigation** (#5) - Accessibility foundation
4. **UI Polish** (#4) - Visual improvements
5. **Test Coverage** (#6) - Prevent regressions
6. **AI Chat Enhancement** (#1) - Core feature improvement
7. **Note Enhancement** (#2) - Core feature improvement
8. **Transcription Accuracy** (#3) - Quality improvement
9. **Responsive Layout** (#9) - UX enhancement
10. **Documentation** (#10) - Maintainability

---

## How to Use These Prompts

1. **Copy** the prompt
2. **Paste** into your AI assistant
3. **Add context**: Paste relevant code when asked
4. **Iterate**: Ask follow-up questions
5. **Implement**: Apply the suggestions
6. **Test**: Verify the changes work
7. **Commit**: Save your progress

Each prompt is designed to produce actionable output in one session.

