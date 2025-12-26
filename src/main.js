import App from './App.svelte';
import './styles.css';

const app = new App({
  target: document.getElementById('app')
});

export default app;

// Register basic service worker for PWA/offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
