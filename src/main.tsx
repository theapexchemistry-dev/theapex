// main.tsx — FIXED: now initializes Firestore sync on startup
// This is the ROOT FIX for "Firebase not syncing across devices".
// Previously, loadInitialDataFromFirestore() was NEVER called, so the app
// only used localStorage (per-device) and never connected to Firestore.
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { loadInitialDataFromFirestore } from './lib/firebaseSync';
import { StorageService } from './lib/storage';

// Render the app immediately (no loading screen)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);

// ── One-time Fee Ledger cleanup ────────────────────────────────────────────
// Runs IMMEDIATELY (before Firestore sync) so the UI never paints with
// stale duplicate records from older buggy versions of the app.
// Idempotent: if there are no duplicates, this is a no-op.
try {
  StorageService.cleanupDuplicateFeeRecords();
} catch (e) {
  console.debug('Fee cleanup skipped:', e);
}

// ── Initialize Firestore sync ──────────────────────────────────────────────
setTimeout(() => {
  // Run the cleanup AGAIN after Firestore data lands, in case the cloud
  // pushed down duplicate records that weren't in local storage.
  try { StorageService.cleanupDuplicateFeeRecords(); } catch (e) { console.debug('Fee cleanup (post-sync) skipped:', e); }
  loadInitialDataFromFirestore().catch((e) => {
    console.debug('Firestore initial sync notice (OK if not configured):', e);
  });
}, 300);
