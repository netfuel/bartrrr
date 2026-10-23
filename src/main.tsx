import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './providers/AuthProvider'
import App from './App'
import { ConfigErrorScreen } from './components/system/ConfigErrorScreen'
import { ErrorBoundary } from './components/system/ErrorBoundary'
import { MISSING_REQUIRED_ENV } from './lib/env'
import { registerServiceWorker } from './lib/push'
import './styles/globals.css'

const root = createRoot(document.getElementById('root')!)

if (MISSING_REQUIRED_ENV.length > 0) {
  console.error(
    `[Bartr] Missing required environment variables: ${MISSING_REQUIRED_ENV.join(', ')}. ` +
      'See .env.example. Set VITE_DEMO_MODE=true to run with sample data instead.',
  )
  root.render(<ConfigErrorScreen missing={MISSING_REQUIRED_ENV} />)
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  )

  // Register the service worker in production so updates are picked up on
  // every visit, not only after someone enables push.
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      void registerServiceWorker()
    })
  }
}
