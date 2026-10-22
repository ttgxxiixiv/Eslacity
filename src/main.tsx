import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initCourse } from './lib/course';
import { initUpdates } from './lib/update';
import { initNative } from './lib/native';

initNative();
initUpdates();
initCourse();

// После обновления приложения старая вкладка может запросить чанк, которого уже нет
// (например, слова ещё не открытой локации). Перезагружаемся на новую версию.
// Без сети перезагрузка не поможет: чанка нет в кэше курса (задача 20.4), экран покажет ошибку загрузки.
window.addEventListener('vite:preloadError', (e) => {
  if (!navigator.onLine) return;
  e.preventDefault();
  location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
