import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { loadInitialDataFromFirestore } from './lib/firebaseSync';
import { handleRedirectResult } from './lib/auth';
import './index.css';

const root = createRoot(document.getElementById('root')!);

// Render a loading state initially
root.render(
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <h2 className="text-xl font-bold">Connecting to Database...</h2>
    <p className="text-slate-400 mt-2">Loading your study portal securely.</p>
  </div>
);

// Process any pending Google OAuth redirect result (from AdminNotes "Connect Gmail")
handleRedirectResult().catch(err => {
  console.debug('No redirect result to process:', err?.message || err);
});

// Load data from Firestore, then render the actual app
loadInitialDataFromFirestore()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch(err => {
    console.error('Failed to load initial data from Firestore:', err);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
