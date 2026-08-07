// main.tsx — FIXED: no loading screen, app opens instantly
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
