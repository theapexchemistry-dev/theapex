import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ── CRITICAL FIX: initialize Firestore with `ignoreUndefinedProperties: true` ──
// Without this flag, Firestore's setDoc()/updateDoc() THROW whenever the data
// object contains an `undefined` field value:
//
//     FirebaseError: Unsupported field value: undefined
//                    (found in field `aiAnsweredAt` in document `doubts/d-xyz`)
//
// This was the ROOT CAUSE of student doubts not reaching the admin panel:
//
//   • Doubt objects legitimately have OPTIONAL fields (aiAnswer, aiAnsweredAt,
//     aiConfidence, aiFollowUp, imageUrl) that are `undefined` whenever a
//     student submits a doubt WITHOUT using the AI assistant / without an image.
//   • addDoubt() calls syncDocToFirestore('doubts', newDoubt.id, newDoubt) with
//     the RAW object → the undefined fields made setDoc() throw → the doubt's
//     per-document sync SILENTLY FAILED (error caught & logged as debug).
//   • The admin's onSnapshot('doubts') therefore never received the new doubt,
//     so it never appeared in the Admin → Doubts section — even though the
//     "New Student Doubt Received" notification (which has its OWN undefined
//     field: targetStudentId) happened to sync via the array path and DID show.
//
// `initializeFirestore` (not `getFirestore`) is the ONLY way to enable this
// setting, and it must run before any getFirestore() for the same app/db. We
// guard with try/catch so HMR / double-init doesn't crash — in that rare case
// we fall back to getFirestore() and rely on the stripUndefined() sanitizer
// inside firebaseSync.ts instead.
function initDb() {
  const databaseId = (firebaseConfig as any).firestoreDatabaseId;
  try {
    return databaseId
      ? initializeFirestore(app, { ignoreUndefinedProperties: true }, databaseId)
      : initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch (e) {
    // Already initialized (e.g. Vite HMR re-evaluated this module) — fall back
    // to getFirestore. The stripUndefined() sanitizer in firebaseSync.ts still
    // guarantees undefined-free writes in this path.
    console.debug('Firestore already initialized, falling back to getFirestore:', e);
    return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

export const db = initDb();

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

export {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
};
