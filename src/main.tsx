import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// После обновления приложения старая вкладка может запросить чанк, которого уже нет
// (например, слова ещё не открытой локации). Перезагружаемся на новую версию.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
