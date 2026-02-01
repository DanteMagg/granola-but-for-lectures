import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { initBrowserMock } from './lib/browserMock'
import { setupGlobalErrorHandling } from './lib/errorHandler'

// Initialize browser mock for development
initBrowserMock()

// Set up global error handling
setupGlobalErrorHandling()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

