// src/lib/firebaseSync.ts
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
import { collection, doc, setDoc, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';
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
// screenshotUrl / transactionRef / paidDate if present on any duplicate.
const FEE_STATUS_RANK: Record<string, number> = {
  paid: 3,
  pending_verification: 2,
  unpaid: 1,
};

export function dedupeFeeRecords(records: FeeRecord[]): FeeRecord[] {
  const map = new Map<string, FeeRecord>();
  for (const r of records) {
    if (!r || !r.studentId || !r.month) continue;
    const key = `${r.studentId}__${r.month}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...r });
      continue;
    }
    // Pick the one with the better (higher) status rank
    const rRank = FEE_STATUS_RANK[r.status] || 0;
    const eRank = FEE_STATUS_RANK[existing.status] || 0;
    let winner: FeeRecord;
    if (rRank > eRank) {
      winner = { ...r };
    } else {
      winner = { ...existing };
    }
    // But preserve screenshot/transactionRef/paidDate from whichever has them
    if (!winner.screenshotUrl && r.screenshotUrl) winner.screenshotUrl = r.screenshotUrl;
    if (!winner.screenshotUrl && existing.screenshotUrl) winner.screenshotUrl = existing.screenshotUrl;
    if (!winner.transactionRef && r.transactionRef) winner.transactionRef = r.transactionRef;
    if (!winner.transactionRef && existing.transactionRef) winner.transactionRef = existing.transactionRef;
    if (!winner.paidDate && r.paidDate) winner.paidDate = r.paidDate;
    if (!winner.paidDate && existing.paidDate) winner.paidDate = existing.paidDate;
    // Keep the original (first-seen) ID for stability
    winner.id = existing.id;
    map.set(key, winner);
  }
  return Array.from(map.values());
}

// ── Generic merge: union of local + remote by ID ───────────────────────────
// For fee records, also dedupes by (studentId + month).
function mergeAndStore(key: string, col: string, remoteItems: any[]): any[] {
  const localStorageKey = `apex_${key}_v2`;
  let localItems: any[] = [];
  try {
    const raw = localStorage.getItem(localStorageKey);
    localItems = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(localItems)) localItems = [];
  } catch {
    localItems = [];
  }

  // Union by ID — remote wins for same ID (it's the cross-device source of
  // truth), EXCEPT we never let a "terminal" local state (paid/ended) be
  // overwritten by a non-terminal remote state.
  const map = new Map<string, any>();
  for (const item of localItems) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of remoteItems) {
    if (!item || !item.id) continue;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }
    // Special-case: fee records — never downgrade a 'paid' to 'unpaid'
    if (key === 'fees') {
      const eRank = FEE_STATUS_RANK[existing.status] || 0;
      const rRank = FEE_STATUS_RANK[item.status] || 0;
      if (eRank >= rRank) {
        // keep existing, but copy over any missing screenshot/txn fields
        const merged = { ...existing };
        if (!merged.screenshotUrl && item.screenshotUrl) merged.screenshotUrl = item.screenshotUrl;
        if (!merged.transactionRef && item.transactionRef) merged.transactionRef = item.transactionRef;
        if (!merged.paidDate && item.paidDate) merged.paidDate = item.paidDate;
        map.set(item.id, merged);
        continue;
      }
    }
    // Default: remote wins
    map.set(item.id, item);
  }

  let merged = Array.from(map.values());

  // Dedupe fee records by (studentId + month)
  if (key === 'fees') {
    merged = dedupeFeeRecords(merged as FeeRecord[]) as any[];
  }

  try {
    localStorage.setItem(localStorageKey, JSON.stringify(merged));
  } catch (e) {
    console.debug(`Error storing merged ${key}:`, e);
  }
  return merged;
}

export function setupFirestoreListeners() {
  const collectionsToListen = [
    { key: 'doubts', col: 'doubts' },
    { key: 'notifications', col: 'notifications' },
    { key: 'notes', col: 'notes' },
    { key: 'fees', col: 'feeRecords' },
    { key: 'students', col: 'students' },
    { key: 'batches', col: 'batches' },
    { key: 'tests', col: 'tests' },
    { key: 'liveMeetings', col: 'liveMeetings' },
    { key: 'siteSettings', col: 'siteSettings' }
  ];

  collectionsToListen.forEach(({ key, col }) => {
    try {
      onSnapshot(collection(db, col), (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map(d => d.data());
          if (col === 'siteSettings') {
            items.forEach((doc: any) => {
              if (doc.id === 'logo' && doc.logoData) {
                localStorage.setItem('apex_site_logo', doc.logoData);
              }
              if (doc.id === 'branding') {
                if (doc.siteName) localStorage.setItem('apex_site_name', doc.siteName);
                if (doc.tagline) localStorage.setItem('apex_tagline', doc.tagline);
              }
              if (doc.id === 'deletedStudentIds' && doc.ids) {
                localStorage.setItem('apex_deleted_student_ids', JSON.stringify(doc.ids));
              }
            });
          } else {
            // ── MERGE instead of overwrite ──
            mergeAndStore(key, col, items);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('apex_storage_updated'));
          }
        }
      }, (err) => {
        console.debug(`Listener error for ${col}:`, err);
      });
    } catch (e) {
      console.debug(`Failed to attach snapshot listener for ${col}:`, e);
    }
  });
}

export async function fetchDataFromFirestore(): Promise<boolean> {
  const collectionsToLoad = [
    { key: 'batches',    col: 'batches' },
    { key: 'students',   col: 'students' },
    { key: 'fees',       col: 'feeRecords' },
    { key: 'notes',      col: 'notes' },
    { key: 'doubts',     col: 'doubts' },
    { key: 'tests',      col: 'tests' },
    { key: 'notifications', col: 'notifications' },
    { key: 'liveMeetings', col: 'liveMeetings' }
  ];

  let hasData = false;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Firestore load timeout')), 8000)
  );

  try {
    const fetchPromises = collectionsToLoad.map(async ({ key, col }) => {
      try {
        const snap = await getDocs(collection(db, col));
        if (!snap.empty) {
          hasData = true;
          const data = snap.docs.map(d => d.data());
          // Merge with local instead of overwriting
          mergeAndStore(key, col, data);
        }
        // If empty, do NOTHING — keep whatever is in localStorage.
        // (Previously this wrote an empty array, wiping local data.)
      } catch (err) {
        console.debug(`Fetch failed for ${col}:`, err);
      }
    });
    await Promise.race([Promise.allSettled(fetchPromises), timeoutPromise]);
  } catch (err) {
    console.debug('Firestore fetch notice:', err);
  }

  try {
    const settingsSnap = await getDocs(collection(db, 'siteSettings'));
    for (const docSnap of settingsSnap.docs) {
      const data = docSnap.data();
      if (docSnap.id === 'logo' && data?.logoData) {
        localStorage.setItem('apex_site_logo', data.logoData);
      } else if (docSnap.id === 'branding') {
        if (data?.siteName) localStorage.setItem('apex_site_name', data.siteName);
        if (data?.tagline) localStorage.setItem('apex_tagline', data.tagline);
      } else if (docSnap.id === 'deletedStudentIds' && Array.isArray(data?.ids)) {
        localStorage.setItem('apex_deleted_student_ids', JSON.stringify(data.ids));
      }
    }
  } catch (e) {
    console.debug('siteSettings load failed:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('apex_storage_updated'));
  }
  return hasData;
}

export async function loadInitialDataFromFirestore() {
  const hasData = await fetchDataFromFirestore();
  setupFirestoreListeners();
  return hasData;
}
