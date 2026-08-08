// src/main.tsx
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { loadInitialDataFromFirestore } from './lib/firebaseSync';

// Render the app immediately (no loading screen)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);

// ── Initialize Firestore sync ──────────────────────────────────────────────
//   1. fetchDataFromFirestore() — pulls all collections from the cloud into
//      localStorage so a brand-new device sees existing data immediately.
//   2. setupFirestoreListeners() — attaches real-time onSnapshot listeners
//      so any change on one device instantly propagates to all other devices.
// We run it AFTER the initial render (tiny delay) so the UI paints instantly
// with whatever is already in localStorage, then refreshes when cloud arrives.
// Errors are swallowed silently — if Firebase isn't configured or is offline,
// the app still works perfectly with local-only storage.
setTimeout(() => {
  loadInitialDataFromFirestore().catch((e) => {
    console.debug('Firestore initial sync notice (OK if not configured):', e);
  });
}, 300);
