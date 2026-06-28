import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary'

const applyInitialTheme = () => {
  try {
    const saved = window.localStorage.getItem('theme')
    const initialTheme = saved === 'light' || saved === 'dark' ? saved : 'dark'
    document.documentElement.setAttribute('data-theme', initialTheme)
    document.documentElement.style.colorScheme = initialTheme
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.style.colorScheme = 'dark'
  }
}

applyInitialTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
