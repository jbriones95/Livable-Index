import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global error handlers to surface runtime errors in production builds
function showFatalError(message) {
  try {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '12px';
    container.style.top = '12px';
    container.style.zIndex = 99999;
    container.style.background = 'rgba(200,40,40,0.95)';
    container.style.color = 'white';
    container.style.padding = '12px';
    container.style.borderRadius = '8px';
    container.style.maxWidth = 'min(90vw,600px)';
    container.style.fontFamily = 'monospace';
    container.style.fontSize = '12px';
    container.textContent = message;
    document.body.appendChild(container);
  } catch (e) {
    // ignore
  }
}

window.addEventListener('error', (ev) => {
  showFatalError(ev.message + ' — ' + (ev.filename || '') + ':' + (ev.lineno || ''));
});
window.addEventListener('unhandledrejection', (ev) => {
  showFatalError('UnhandledRejection: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)));
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
