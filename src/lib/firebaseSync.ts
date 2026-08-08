/**
 * ============================================================================
 *  firebaseSync.ts — Real-time meeting sync via Firestore
 * ----------------------------------------------------------------------------
 *  Paste this file at:  src/lib/firebaseSync.ts  (in your Vite project)
 *
 *  This file provides 5 functions:
 *    - subscribeToAllMeetings(onUpdate, onError)    → real-time listener (active + ended)
 *    - subscribeToActiveMeetings(onUpdate, onError) → real-time listener (active only)
 *    - startMeeting(meeting)                        → admin creates a meeting
 *    - endMeeting(id)                               → admin ends a meeting (keeps history)
 *    - deleteMeeting(id)                            → admin permanently deletes a record
 *
 *  IMPORTANT: endMeeting() does NOT delete the document — it just sets
 *  `active: false` and `endedAt: <now>`. This way the meeting stays in the
 *  history. Use deleteMeeting() only when you want to permanently remove it.
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

// ---------- Types ----------
export interface LiveMeeting {
  id: string;
  title: string;
  scope: "batch" | "class" | "all";
  batchId?: string | null;
  batchTitle?: string | null;
  className?: string | null;
  teacherName: string;
  roomName: string;        // the Jitsi room name (used to build the join URL)
  startedAt: number;       // epoch ms
  durationMins: number;
  active: boolean;
  endedAt?: number | null;
  createdAt: number;
}

const COLLECTION = "liveMeetings";

// ---------- 1a. Real-time subscription to ALL meetings (active + ended) ----------
// Use this in your component. It returns BOTH live and recently-ended meetings
// so you can show a "Recent classes" history section. The component splits them
// into active vs past using the `active` field.
export function subscribeToAllMeetings(
  onUpdate: (meetings: LiveMeeting[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // No `where` filter — we want both active and ended meetings.
  const q = query(collection(db, COLLECTION));

  return onSnapshot(
    q,
    (snap) => {
      const meetings: LiveMeeting[] = [];
      snap.forEach((d) => {
        const data = d.data() as LiveMeeting;
        meetings.push({ ...data, id: d.id });
      });
      // newest first by startedAt
      meetings.sort((a, b) => b.startedAt - a.startedAt);
      onUpdate(meetings);
    },
    (err) => {
      console.error("[firebaseSync] onSnapshot error:", err);
      onError?.(err);
    }
  );
}

// ---------- 1b. Real-time subscription to ACTIVE meetings only ----------
// (Kept for backwards compat. Prefer subscribeToAllMeetings + filter in UI.)
export function subscribeToActiveMeetings(
  onUpdate: (meetings: LiveMeeting[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTION), where("active", "==", true));

  return onSnapshot(
    q,
    (snap) => {
      const meetings: LiveMeeting[] = [];
      snap.forEach((d) => {
        const data = d.data() as LiveMeeting;
        meetings.push({ ...data, id: d.id });
      });
      meetings.sort((a, b) => b.startedAt - a.startedAt);
      onUpdate(meetings);
    },
    (err) => {
      console.error("[firebaseSync] onSnapshot error:", err);
      onError?.(err);
    }
  );
}

// ---------- 2. Admin starts a meeting ----------
export async function startMeeting(meeting: LiveMeeting): Promise<void> {
  const ref = doc(db, COLLECTION, meeting.id);
  await setDoc(ref, {
    ...meeting,
    active: true,
    endedAt: null,
    createdAt: Date.now(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ---------- 3. Admin ends a meeting ----------
// NOTE: This does NOT delete the document. It only marks it inactive and
// records when it ended. The meeting stays in Firestore so it appears in the
// "Recent classes" history section on every device.
export async function endMeeting(id: string): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await setDoc(ref, {
    active: false,
    endedAt: Date.now(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ---------- 4. Admin permanently deletes a meeting record ----------
// Use this only when you want to wipe the history entry completely.
export async function deleteMeeting(id: string): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await deleteDoc(ref);
}
