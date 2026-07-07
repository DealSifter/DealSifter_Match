import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { initObservability } from './lib/observability'

const applyInitialTheme = () => {
  try {
    const url = new URL(window.location.href)
    const hash = String(window.location.hash || '')
    const isAuthCallback = url.searchParams.has('code')
      || url.searchParams.has('error')
      || hash.includes('access_token=')
    const saved = window.localStorage.getItem('theme')
    const explicitTheme = window.localStorage.getItem('ds_theme_user_choice')
    const savedTheme = saved === 'light' || saved === 'dark' ? saved : ''
    const userTheme = explicitTheme === savedTheme ? savedTheme : ''
    const initialTheme = isAuthCallback
      ? 'light'
      : (userTheme || 'light')
    document.documentElement.setAttribute('data-theme', initialTheme)
    document.documentElement.style.colorScheme = initialTheme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', initialTheme === 'dark' ? '#0b1514' : '#f6fbfb')
  } catch {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.style.colorScheme = 'light'
  }
}

applyInitialTheme()
initObservability()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
