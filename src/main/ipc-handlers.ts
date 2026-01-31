// IPC handlers are now registered in the native bridge files:
// - src/main/native/whisper-bridge.ts (registerWhisperHandlers)
// - src/main/native/llm-bridge.ts (registerLLMHandlers)
//
// This file is kept for reference and can be used for additional
// IPC handlers that don't fit in the bridge files.

import { ipcMain } from 'electron'

// Register any additional handlers here
export function registerAdditionalHandlers() {
  // Placeholder for future handlers
  // Add any non-AI-related IPC handlers here
}

// Re-export the native handlers for convenience
export { registerWhisperHandlers, getWhisperBridge } from './native/whisper-bridge'
export { registerLLMHandlers, getLLMBridge } from './native/llm-bridge'
