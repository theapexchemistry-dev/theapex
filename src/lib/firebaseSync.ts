/**
 * ============================================================================
 *  firebaseSync.ts — Firestore real-time sync utilities
 * ----------------------------------------------------------------------------
 *  This file is the single source of truth for talking to Firestore.
 *  It exports EVERYTHING the rest of the app needs:
 *
 *  (A) Generic sync helpers (storage.ts, backup.ts, AdminFees.tsx):
 *        - syncArrayToFirestore(collectionName, items)
 *        - syncDocToFirestore(collectionName, docId, data)
 *        - deleteFromFirestore(collectionName, docId)
 *
 *  (B) Bootstrap + listener helpers (main.tsx, AdminDashboard.tsx):
 *        - loadInitialDataFromFirestore()    → pull cloud → localStorage
 *        - fetchDataFromFirestore()          → same, manual trigger
 *        - setupFirestoreListeners()         → real-time onSnapshot listeners
 *
 *  (C) Live meeting helpers (LiveClasses.tsx):
 *        - subscribeToAllMeetings(onUpdate, onError)
 *        - subscribeToActiveMeetings(onUpdate, onError)
 *        - startMeeting(meeting)
 *        - endMeeting(id)        → marks inactive (keeps history)
 *        - deleteMeeting(id)     → permanently deletes
 * ============================================================================
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

// ============================================================================
//  Types
// ============================================================================
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
  durationMins: number;
  active: boolean;
  endedAt?: number | null;
  createdAt: number;
}

// Collections that get synced between devices via Firestore.
// Each entry maps a Firestore collection name → its localStorage key.
const SYNCED_COLLECTIONS: Record<string, string> = {
  batches: "apex_batches_v2",
  students: "apex_students_v2",
  feeRecords: "apex_fees_v2",
  notes: "apex_notes_v2",
  doubts: "apex_doubts_v2",
  tests: "apex_tests_v2",
  notifications: "apex_notifications_v2",
};

// ============================================================================
//  (A) GENERIC SYNC HELPERS
// ============================================================================

/**
 * Sync a whole array of items to a Firestore collection.
 * Each item must have an `id` field — it becomes the document ID.
 */
export async function syncArrayToFirestore(
  collectionName: string,
  items: any[]
): Promise<void> {
  try {
    if (!db) return;
    const colRef = collection(db as any, collectionName);
    const writes = items
      .filter((it) => it && it.id)
      .map((it) =>
        setDoc(doc(colRef, String(it.id)), { ...it, updatedAt: serverTimestamp() }, { merge: true })
      );
    await Promise.all(writes);
  } catch (err) {
    console.error(`[firebaseSync] syncArrayToFirestore(${collectionName}) failed:`, err);
  }
}

/**
 * Sync a single document to a Firestore collection.
 */
export async function syncDocToFirestore(
  collectionName: string,
  docId: string,
  data: any
): Promise<void> {
  try {
    if (!db) return;
    const ref = doc(db as any, collectionName, docId);
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error(`[firebaseSync] syncDocToFirestore(${collectionName}, ${docId}) failed:`, err);
  }
}

/**
 * Delete a single document from a Firestore collection.
 */
export async function deleteFromFirestore(
  collectionName: string,
  docId: string
): Promise<void> {
  try {
    if (!db) return;
    const ref = doc(db as any, collectionName, docId);
    await deleteDoc(ref);
  } catch (err) {
    console.error(`[firebaseSync] deleteFromFirestore(${collectionName}, ${docId}) failed:`, err);
  }
}

// ============================================================================
//  (B) BOOTSTRAP + LISTENERS
// ============================================================================

/**
 * Pull every synced collection from Firestore into localStorage, then attach
 * real-time listeners so future changes propagate automatically.
 * Safe to call on app start — silently no-ops if Firebase isn't configured.
 */
export async function loadInitialDataFromFirestore(): Promise<void> {
  try {
    if (!db) return;
    await fetchDataFromFirestore();
    setupFirestoreListeners();
  } catch (err) {
    console.debug("[firebaseSync] loadInitialDataFromFirestore notice:", err);
  }
}

/**
 * Manually pull every synced collection from Firestore into localStorage.
 * Called by AdminDashboard "Sync now" button.
 */
export async function fetchDataFromFirestore(): Promise<void> {
  try {
    if (!db) return;
    const { getDocs } = await import("firebase/firestore");
    const entries = Object.entries(SYNCED_COLLECTIONS);
    await Promise.all(
      entries.map(async ([colName, storageKey]) => {
        try {
          const snap = await getDocs(collection(db as any, colName));
          const items: any[] = [];
          snap.forEach((d: any) => items.push({ ...d.data(), id: d.id }));
          localStorage.setItem(storageKey, JSON.stringify(items));
          window.dispatchEvent(new Event("apex_storage_updated"));
        } catch (e) {
          console.debug(`[firebaseSync] fetch ${colName} failed:`, e);
        }
      })
    );
  } catch (err) {
    console.debug("[firebaseSync] fetchDataFromFirestore notice:", err);
  }
}

/**
 * Attach real-time onSnapshot listeners to every synced collection.
 * When any doc changes in Firestore, this updates localStorage and fires
 * an "apex_storage_updated" event so the UI re-renders.
 * Returns an unsubscribe function that tears down all listeners.
 */
export function setupFirestoreListeners(): () => void {
  if (!db) return () => {};
  const unsubscribers: Array<() => void> = [];

  Object.entries(SYNCED_COLLECTIONS).forEach(([colName, storageKey]) => {
    try {
      const q = collection(db as any, colName);
      const unsub = onSnapshot(
        q as any,
        (snap: any) => {
          const items: any[] = [];
          snap.forEach((d: any) => items.push({ ...d.data(), id: d.id }));
          localStorage.setItem(storageKey, JSON.stringify(items));
          window.dispatchEvent(new Event("apex_storage_updated"));
        },
        (err: Error) => {
          console.debug(`[firebaseSync] listener ${colName} error:`, err);
        }
      );
      unsubscribers.push(unsub as any);
    } catch (e) {
      console.debug(`[firebaseSync] attach ${colName} failed:`, e);
    }
  });

  return () => unsubscribers.forEach((u) => {
    try { u(); } catch { /* noop */ }
  });
}

// ============================================================================
//  (C) LIVE MEETING HELPERS
// ============================================================================
const MEETINGS_COLLECTION = "liveMeetings";

/**
 * Subscribe to ALL meetings (active + ended) in real-time.
 * Use this so you can show a "Recent classes" history section.
 */
export function subscribeToAllMeetings(
  onUpdate: (meetings: LiveMeeting[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db as any, MEETINGS_COLLECTION));

  return onSnapshot(
    q as any,
    (snap: any) => {
      const meetings: LiveMeeting[] = [];
      snap.forEach((d: any) => {
        const data = d.data() as LiveMeeting;
        meetings.push({ ...data, id: d.id });
      });
      meetings.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      onUpdate(meetings);
    },
    (err: Error) => {
      console.error("[firebaseSync] onSnapshot error:", err);
      onError?.(err);
    }
  );
}

/**
 * Subscribe to ACTIVE meetings only (backwards-compat).
 */
export function subscribeToActiveMeetings(
  onUpdate: (meetings: LiveMeeting[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db as any, MEETINGS_COLLECTION), where("active", "==", true));

  return onSnapshot(
    q as any,
    (snap: any) => {
      const meetings: LiveMeeting[] = [];
      snap.forEach((d: any) => {
        const data = d.data() as LiveMeeting;
        meetings.push({ ...data, id: d.id });
      });
      meetings.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      onUpdate(meetings);
    },
    (err: Error) => {
      console.error("[firebaseSync] onSnapshot error:", err);
      onError?.(err);
    }
  );
}

/**
 * Admin starts a meeting.
 */
export async function startMeeting(meeting: LiveMeeting): Promise<void> {
  const ref = doc(db as any, MEETINGS_COLLECTION, meeting.id);
  await setDoc(ref, {
    ...meeting,
    active: true,
    endedAt: null,
    createdAt: Date.now(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Admin ends a meeting — marks inactive + records end time.
 * Does NOT delete, so it appears in history.
 */
export async function endMeeting(id: string): Promise<void> {
  const ref = doc(db as any, MEETINGS_COLLECTION, id);
  await setDoc(ref, {
    active: false,
    endedAt: Date.now(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Admin permanently deletes a meeting record.
 */
export async function deleteMeeting(id: string): Promise<void> {
  const ref = doc(db as any, MEETINGS_COLLECTION, id);
  await deleteDoc(ref);
}
