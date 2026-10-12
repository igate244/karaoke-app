import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initStore } from './store';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);

initStore().catch((e) => {
  document.getElementById('root')!.innerHTML =
    `<div class="boot">データを開けませんでした。<br>プライベートブラウズでは使えないことがあります。<br><small>${String(e)}</small></div>`;
});

// PWA：オフライン対応。新しい版が入ったら次の起動で切り替わる。
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
