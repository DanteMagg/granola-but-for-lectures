// IPC handler re-exports for convenient access
// Main handlers are registered in the native bridge files

// Re-export the native handlers
export { registerWhisperHandlers, getWhisperBridge } from './native/whisper-bridge.js'
export { registerLLMHandlers, getLLMBridge } from './native/llm-bridge.js'
