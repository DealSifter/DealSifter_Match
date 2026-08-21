import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { initObservability } from './lib/observability'
import { startWebVitals } from './lib/webVitals'

if (initObservability()) startWebVitals()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
