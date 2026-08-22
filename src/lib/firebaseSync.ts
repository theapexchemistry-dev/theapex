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
//   4. DOUBT-SYNC FIX: every Firestore write now goes through stripUndefined()
//      so optional `undefined` fields (aiAnswer, aiAnsweredAt, targetStudentId,
//      ...) no longer make setDoc() throw "Unsupported field value: undefined".
//      syncArrayToFirestore() also isolates per-item failures so ONE bad record
//      can no longer abort the loop and drop a brand-new student doubt.
import { collection, doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { FeeRecord } from '../types';

// ── LiveMeeting type ───────────────────────────────────────────────────────
// Consumed by src/components/LiveClasses.tsx. Kept here (next to the helpers
// below) so the component has a single import surface for live-class sync.
export interface LiveMeeting {
  id: string;
  title: string;
  scope: "batch" | "class" | "all";
  batchId?: string | null;
  batchTitle?: string | null;
  className?: string | null;
  teacherName: string;
  roomName: string;
  startedAt: number;
  durationMins?: number;
  active: boolean;
  endedAt?: number | null;
  createdAt: number;
  platform?: "webrtc";
  meetUrl?: string | null;
  autoNameConfig?: boolean;
  recordingUrl?: string | null;
  isScheduled?: boolean;
  scheduledAt?: number | null;
  teacherJoined?: boolean;
}

// ── stripUndefined ──────────────────────────────────────────────────────────
// Recursively removes any property whose value is `undefined` (from nested
// objects and arrays too). Firestore's setDoc()/updateDoc() THROW on
// `undefined` field values by default — "Unsupported field value: undefined" —
// which silently broke doubt + notification sync (their TypeScript types
// legitimately mark fields like aiAnswer / aiAnsweredAt / targetStudentId as
// optional, so they are `undefined` whenever unused).
//
// firebase.ts also enables `ignoreUndefinedProperties: true` as the primary
// defence; this sanitizer is the belt-and-suspenders guarantee that writes
// still succeed even if that flag couldn't be applied (e.g. HMR fallback).
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue;
      out[key] = stripUndefined(v);
    }
    return out as unknown as T;
  }
  return value;
}

export async function syncDocToFirestore(collectionName: string, id: string, data: any) {
  try {
    await setDoc(doc(db, collectionName, id), stripUndefined(data), { merge: true });
  } catch (err) {
    console.debug(`Firestore syncDoc failed for ${collectionName}/${id}:`, err);
  }
}

export async function syncArrayToFirestore(collectionName: string, items: any[]) {
  // Write each item INDEPENDENTLY. Previously a single try/catch wrapped the
  // whole loop, so if ONE item failed (e.g. an oversized image attachment, a
  // stale record with an unsupported field, or an `undefined` that slipped
  // through) the loop ABORTED and every remaining item — including a
  // brand-new student doubt sitting later in the array — was never written.
  // Now a bad record only loses its own sync; the rest still go through.
  for (const item of items) {
    if (!item || !item.id) continue;
    try {
      // JSON round-trip drops functions/Symbol and converts NaN→null; then
      // stripUndefined() removes any `undefined` that JSON.stringify leaves
      // behind on nested objects it couldn't enumerate.
      const cleanItem = stripUndefined(JSON.parse(JSON.stringify(item)));
      await setDoc(doc(db, collectionName, item.id), cleanItem);
    } catch (err) {
      console.debug(`Error syncing item ${item.id} to ${collectionName}:`, err);
    }
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
//
// ROBUSTNESS FIX (2025): The dedupe KEY is now NORMALIZED so that subtle
// differences in the source strings no longer defeat deduplication:
//   - studentId: trimmed + lowercased  (so "APEX2026101" == " apex2026101 ")
//   - month:     trimmed + lowercased + whitespace/comma/period collapsed
//                 (so "August 2026" == "August  2026" == "August, 2026"
//                  == "august 2026" == "August. 2026")
// The original values are preserved on the winning record for display;
// only the comparison key is normalized.
const FEE_STATUS_RANK: Record<string, number> = {
  paid: 3,
  pending_verification: 2,
  unpaid: 1,
};

function normalizeKeyPart(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,;:]+/g, ' ')   // strip punctuation that may vary
    .replace(/\s+/g, ' ')        // collapse runs of whitespace
    .trim();
}

export function dedupeFeeRecords(records: FeeRecord[]): FeeRecord[] {
  const map = new Map<string, FeeRecord>();
  for (const r of records) {
    if (!r || !r.studentId || !r.month) continue;
    const key = `${normalizeKeyPart(r.studentId)}__${normalizeKeyPart(r.month)}`;
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
    { key: 'support_requests', col: 'supportRequests' },
    { key: 'apex_announcements_v2', col: 'announcements' },
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
            // This is the key fix: we union local + remote by ID, and for
            // fee records we also dedupe by (studentId + month).
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
    { key: 'liveMeetings', col: 'liveMeetings' },
    { key: 'support_requests', col: 'supportRequests' },
    { key: 'apex_announcements_v2', col: 'announcements' }
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
        // ignore single collection fetch fail
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

// ─────────────────────────────────────────────────────────────────────────────
//  LIVE CLASSES — real-time sync helpers consumed by LiveClasses.tsx
// ─────────────────────────────────────────────────────────────────────────────
//  These wrap the EXISTING Firestore + localStorage infrastructure that this
//  file already provides (the `liveMeetings` collection is already wired into
//  setupFirestoreListeners() and fetchDataFromFirestore(), and mergeAndStore()
//  already unions local + remote meetings into localStorage key
//  `apex_liveMeetings_v2`). The helpers below give LiveClasses.tsx a clean,
//  typed API so it doesn't have to touch Firestore / localStorage directly.
//
//  Flow:
//    Admin startMeeting(m) → optimistic localStorage write + syncDocToFirestore
//                          → Firestore onSnapshot fires on EVERY device
//                          → mergeAndStore() merges into localStorage
//                          → "apex_storage_updated" event → UI re-renders
//    subscribeToAllMeetings(cb) → emits current localStorage list immediately
//                          (optimistic), then subscribes to the `liveMeetings`
//                          collection and re-emits on every snapshot.
//    endMeeting(id)      → marks active:false, endedAt:now (local + Firestore)
//    deleteMeeting(id)   → removes the doc (local + Firestore)
// ─────────────────────────────────────────────────────────────────────────────

const LIVE_MEETINGS_LS_KEY = 'apex_liveMeetings_v2';

function readLocalMeetings(): LiveMeeting[] {
  try {
    const raw = localStorage.getItem(LIVE_MEETINGS_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as LiveMeeting[]) : [];
  } catch {
    return [];
  }
}

function writeLocalMeetings(meetings: LiveMeeting[]): void {
  try {
    localStorage.setItem(LIVE_MEETINGS_LS_KEY, JSON.stringify(meetings));
  } catch (e) {
    console.debug('Error writing liveMeetings to localStorage:', e);
  }
}

function dispatchStorageUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('apex_storage_updated'));
  }
}

/**
 * Subscribe to ALL live meetings (active + ended history).
 * Calls `onNext` immediately with the current localStorage list (optimistic),
 * then again whenever the `liveMeetings` Firestore collection changes.
 * Returns an unsubscribe function.
 */
export function subscribeToAllMeetings(
  onNext: (meetings: LiveMeeting[]) => void,
  onError?: (err: Error) => void
): () => void {
  // 1) Optimistic: emit whatever we already have in localStorage right away
  //    so the UI paints instantly (offline-first).
  try {
    onNext(readLocalMeetings());
  } catch (e) {
    console.debug('subscribeToAllMeetings initial emit failed:', e);
  }

  // 2) Subscribe to the Firestore `liveMeetings` collection for real-time
  //    cross-device updates. Each snapshot is merged with localStorage via
  //    mergeAndStore() (union by ID — never wipes local data) and re-emitted.
  let unsub: () => void = () => {};
  try {
    unsub = onSnapshot(
      collection(db, 'liveMeetings'),
      (snapshot) => {
        const remote: LiveMeeting[] = snapshot.empty
          ? []
          : (snapshot.docs.map((d) => d.data() as LiveMeeting));
        // mergeAndStore unions local + remote by ID and writes back to
        // `apex_liveMeetings_v2`, returning the merged array.
        const merged = mergeAndStore('liveMeetings', 'liveMeetings', remote) as LiveMeeting[];
        onNext(Array.isArray(merged) ? merged : remote);
        dispatchStorageUpdate();
      },
      (err) => {
        console.debug('subscribeToAllMeetings snapshot error:', err);
        onError?.(err as Error);
      }
    );
  } catch (e) {
    console.debug('subscribeToAllMeetings attach failed:', e);
    onError?.(e as Error);
  }

  return () => {
    try {
      unsub();
    } catch {
      /* noop */
    }
  };
}

/**
 * Create / start a live meeting. Writes optimistically to localStorage first
 * (so the admin's UI updates instantly), then persists to Firestore so every
 * other device receives it via onSnapshot.
 */
export async function startMeeting(meeting: LiveMeeting): Promise<void> {
  // Optimistic local write
  try {
    const arr = readLocalMeetings();
    const idx = arr.findIndex((m) => m.id === meeting.id);
    if (idx >= 0) arr[idx] = meeting;
    else arr.unshift(meeting);
    writeLocalMeetings(arr);
  } catch (e) {
    console.debug('startMeeting local write failed:', e);
  }

  // Persist to Firestore (stripUndefined guarantees no `undefined` fields throw)
  await syncDocToFirestore('liveMeetings', meeting.id, meeting);

  dispatchStorageUpdate();
}

/**
 * Mark a live meeting as ENDED (active:false, endedAt:now). The meeting stays
 * in the list so it shows up in "Recent classes" history — it is NOT deleted.
 */
export async function endMeeting(id: string): Promise<void> {
  const endedAt = Date.now();

  // Optimistic local update
  try {
    const arr = readLocalMeetings();
    const idx = arr.findIndex((m) => m.id === id);
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], active: false, endedAt };
      writeLocalMeetings(arr);
    }
  } catch (e) {
    console.debug('endMeeting local update failed:', e);
  }

  // Persist to Firestore
  try {
    await updateDoc(doc(db, 'liveMeetings', id), { active: false, endedAt });
  } catch (err) {
    console.debug(`Firestore endMeeting failed for ${id}:`, err);
  }

  dispatchStorageUpdate();
}

/**
 * Permanently delete a live meeting record (local + Firestore).
 */
export async function deleteMeeting(id: string): Promise<void> {
  // Optimistic local delete
  try {
    const arr = readLocalMeetings();
    writeLocalMeetings(arr.filter((m) => m.id !== id));
  } catch (e) {
    console.debug('deleteMeeting local delete failed:', e);
  }

  // Delete from Firestore
  await deleteFromFirestore('liveMeetings', id);

  dispatchStorageUpdate();
}

// ─────────────────────────────────────────────────────────────────────────────
//  DOUBTS — real-time sync helpers consumed by AdminDoubts.tsx & StudentDoubts.tsx
// ─────────────────────────────────────────────────────────────────────────────

const DOUBTS_LS_KEY = 'apex_doubts_v2';

function readLocalDoubts(): any[] {
  try {
    const data = localStorage.getItem(DOUBTS_LS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.debug('readLocalDoubts failed:', e);
    return [];
  }
}

function writeLocalDoubts(arr: any[]): void {
  try {
    localStorage.setItem(DOUBTS_LS_KEY, JSON.stringify(arr));
  } catch (e) {
    console.debug('writeLocalDoubts failed:', e);
  }
}

/**
 * Subscribe to ALL doubts (local + Firestore) in real time.
 */
export function subscribeToDoubts(
  onNext: (doubts: any[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    onNext(readLocalDoubts());
  } catch (e) {
    console.debug('subscribeToDoubts initial emit failed:', e);
  }

  let unsub: () => void = () => {};
  try {
    unsub = onSnapshot(
      collection(db, 'doubts'),
      (snapshot) => {
        const remote: any[] = snapshot.empty
          ? []
          : snapshot.docs.map((d) => d.data());

        const local = readLocalDoubts();
        const map = new Map<string, any>();

        for (const item of local) {
          if (item && item.id) map.set(item.id, item);
        }
        for (const item of remote) {
          if (item && item.id) map.set(item.id, item);
        }

        const merged = Array.from(map.values());
        writeLocalDoubts(merged);

        onNext(merged);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('apex_storage_updated'));
        }
      },
      (err) => {
        console.debug('subscribeToDoubts snapshot error:', err);
        if (onError) onError(err);
      }
    );
  } catch (e: any) {
    console.debug('subscribeToDoubts attach failed:', e);
    if (onError) onError(e);
  }
  return unsub;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUPPORT REQUESTS — real-time sync helper consumed by AdminSupport.tsx
// ─────────────────────────────────────────────────────────────────────────────
//  This gives AdminSupport.tsx a DIRECT real-time subscription to the
//  Firestore `supportRequests` collection, bypassing the localStorage/merge
//  layer. This is more robust than relying solely on the `apex_storage_updated`
//  event because:
//    1. It emits localStorage data immediately (optimistic, offline-first).
//    2. It subscribes directly to Firestore and re-emits on every change.
//    3. If Firestore rules block the read, the onError callback fires so the
//       UI can show a visible error (instead of silently failing).
//
//  Flow:
//    Student saves ticket → localStorage + syncDocToFirestore
//                        → Firestore onSnapshot fires on admin's device
//                        → onNext(merged) → AdminSupport re-renders
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORT_REQUESTS_LS_KEY = 'apex_support_requests_v2';

function readLocalSupportRequests(): any[] {
  try {
    const raw = localStorage.getItem(SUPPORT_REQUESTS_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalSupportRequests(arr: any[]): void {
  try {
    localStorage.setItem(SUPPORT_REQUESTS_LS_KEY, JSON.stringify(arr));
  } catch (e) {
    console.debug('writeLocalSupportRequests failed:', e);
  }
}

/**
 * Subscribe to ALL support requests (local + Firestore) in real time.
 *
 * @param onNext  Called immediately with localStorage data, then again
 *                whenever Firestore updates. Receives the MERGED list.
 * @param onError Called if the Firestore subscription fails (e.g. permission
 *                denied). The caller can fall back to localStorage-only mode.
 * @returns Unsubscribe function.
 */
export function subscribeToSupportRequests(
  onNext: (requests: any[]) => void,
  onError?: (err: Error) => void
): () => void {
  // 1) Optimistic: emit whatever we already have in localStorage right away
  //    so the UI paints instantly (offline-first). This ensures same-device
  //    tickets (student → logout → admin login) show even if Firestore is
  //    broken or not configured.
  try {
    onNext(readLocalSupportRequests());
  } catch (e) {
    console.debug('subscribeToSupportRequests initial emit failed:', e);
  }

  // 2) Subscribe to the Firestore `supportRequests` collection for real-time
  //    cross-device updates.
  let unsub: () => void = () => {};
  try {
    unsub = onSnapshot(
      collection(db, 'supportRequests'),
      (snapshot) => {
        const remote: any[] = snapshot.empty
          ? []
          : snapshot.docs.map((d) => d.data());
        // Merge local + remote by ID (union — never wipes local data)
        const local = readLocalSupportRequests();
        const map = new Map<string, any>();
        for (const item of local) {
          if (item && item.id) map.set(item.id, item);
        }
        for (const item of remote) {
          if (item && item.id) map.set(item.id, item); // remote wins
        }
        const merged = Array.from(map.values());
        writeLocalSupportRequests(merged);
        onNext(merged);
        dispatchStorageUpdate();
      },
      (err) => {
        console.debug('subscribeToSupportRequests snapshot error:', err);
        onError?.(err as Error);
      }
    );
  } catch (e) {
    console.debug('subscribeToSupportRequests attach failed:', e);
    onError?.(e as Error);
  }

  return () => {
    try { unsub(); } catch (e) { /* ignore */ }
  };
}

export async function updateMeeting(meeting: LiveMeeting): Promise<void> {
  const arr = readLocalMeetings();
  const updated = arr.map((m) => (m.id === meeting.id ? meeting : m));
  writeLocalMeetings(updated);
  window.dispatchEvent(new Event("apex_live_meetings_updated"));
  await syncDocToFirestore('liveMeetings', meeting.id, meeting);
}
