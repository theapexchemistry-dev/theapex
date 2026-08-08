// firebaseSync.ts — FIXED
// CRITICAL FIXES:
//   1. The onSnapshot listener now MERGES Firestore data with local data
//      (union by ID) instead of OVERWRITING. Previously, an empty or partial
//      Firestore snapshot would wipe out locally-saved records.
//   2. Fee records are DEDUPED by (studentId + month) — duplicate records
//      (which appear when two devices each create a record for the same
//      student+month with different IDs) are collapsed into one, keeping the
//      best status: paid > pending_verification > unpaid.
//   3. The merge prefers "terminal" states — e.g., a record marked 'paid' or
//      'ended' always wins over an 'unpaid' / 'active' duplicate.
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { FeeRecord } from '../types';

export async function syncDocToFirestore(collectionName: string, id: string, data: any) {
  try {
    await setDoc(doc(db, collectionName, id), data, { merge: true });
  } catch (err) {
    console.debug(`Firestore syncDoc failed for ${collectionName}/${id}:`, err);
  }
}

export async function syncArrayToFirestore(collectionName: string, items: any[]) {
  try {
    for (const item of items) {
      if (item.id) {
        const cleanItem = JSON.parse(JSON.stringify(item));
        await setDoc(doc(db, collectionName, item.id), cleanItem);
      }
    }
  } catch (err) {
    console.debug(`Error syncing ${collectionName} to Firestore:`, err);
  }
}

export async function deleteFromFirestore(collectionName: string, id: string) {
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (err) {
    console.debug(`Error deleting ${id} from ${collectionName}:`, err);
  }
}

// ── Dedupe helper for fee records ──────────────────────────────────────────
// Collapses records that share the same (studentId + month) into a single
// record, keeping the one with the "best" status. Also preserves the
// screenshotUrl
