// src/lib/pushNotifications.ts
// ---------------------------------------------------------------------------
// Firebase Cloud Messaging (FCM) wrapper for THE APEX WORLD.
// Handles browser permission, token generation, and foreground message
// display so notifications hit the phone's notification bar (PWA / installed)
// AND the in-app bell.
// ---------------------------------------------------------------------------

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  deleteToken,
  type MessagePayload
} from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

// 🔧 Change this to your deployed domain (e.g. https://theapex.vercel.app).
// Must match exactly the domain registered in Firebase Console > Project settings > Cloud Messaging > Web Push certificates.
const VAPID_KEY = 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY_FROM_FIREBASE_CONSOLE';

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

async function ensureMessaging() {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported();
  if (!supported) {
    console.warn('[FCM] Messaging is not supported in this browser.');
    return null;
  }
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PushPermissionState;
}

/**
 * Request notification permission from the user and (if granted) generate
 * an FCM registration token. The token is then sent to Firestore so the
 * Cloud Function can target this device.
 *
 * @param role        'admin' | 'student'
 * @param studentId   only for student role — used to target this device only
 */
export async function enablePushNotifications(
  role: 'admin' | 'student',
  studentId?: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const messaging = await ensureMessaging();
    if (!messaging) return { success: false, error: 'Messaging not supported in this browser.' };

    if (!('Notification' in window)) {
      return { success: false, error: 'This browser does not support notifications.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'User denied notification permission.' };
    }

    if (!VAPID_KEY || VAPID_KEY.startsWith('REPLACE_WITH')) {
      return { success: false, error: 'VAPID key not configured. Edit src/lib/pushNotifications.ts.' };
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) {
      return { success: false, error: 'Failed to obtain FCM token.' };
    }

    // Persist token to Firestore so the Cloud Function can send pushes to it.
    await saveTokenToFirestore(token, role, studentId);

    // Listen for foreground messages so we can show them in-app too.
    attachForegroundListener();

    return { success: true, token };
  } catch (err: any) {
    console.error('[FCM] enablePushNotifications error:', err);
    return { success: false, error: err?.message || 'Unknown error enabling notifications.' };
  }
}

/**
 * Disable push notifications — revokes permission on this device and deletes
 * the token from Firestore.
 */
export async function disablePushNotifications(
  role: 'admin' | 'student',
  studentId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const messaging = await ensureMessaging();
    if (!messaging) return { success: true };

    const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);
    if (token) {
      await deleteToken(messaging);
      await removeTokenFromFirestore(token, role, studentId);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown error disabling notifications.' };
  }
}

let foregroundListenerAttached = false;
function attachForegroundListener() {
  if (foregroundListenerAttached) return;
  ensureMessaging().then((messaging) => {
    if (!messaging) return;
    onMessage(messaging, (payload: MessagePayload) => {
      // Foreground message: show in-app bell notification + browser toast.
      console.log('[FCM] Foreground message:', payload);
      const { title, body } = payload.notification ?? {};
      if (title && body) {
        try {
          new Notification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'apex-push-' + Date.now()
          });
        } catch {
          // ignore — some browsers block foreground Notification constructor
        }
      }
    });
    foregroundListenerAttached = true;
  });
}

// ---------------------------------------------------------------------------
// Firestore token registry
// ---------------------------------------------------------------------------

import { db, doc, setDoc, deleteDoc, collection, getDocs, query, where } from './firebase';

const TOKENS_COLLECTION = 'pushTokens';

async function saveTokenToFirestore(token: string, role: 'admin' | 'student', studentId?: string) {
  await setDoc(doc(db, TOKENS_COLLECTION, token), {
    token,
    role,
    studentId: studentId || null,
    platform: detectPlatform(),
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  });
}

async function removeTokenFromFirestore(token: string, _role: 'admin' | 'student', _studentId?: string) {
  await deleteDoc(doc(db, TOKENS_COLLECTION, token));
}

function detectPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

// ---------------------------------------------------------------------------
// Helper used by the storage layer — call this whenever a NotificationItem
// is created, so that the Cloud Function (via Firestore trigger) can push it.
// We also keep it as a fallback that writes a "pushQueue" doc the function
// can read. This way push works even without Firestore onSnapshot triggers.
// ---------------------------------------------------------------------------

export async function enqueuePushNotification(notif: {
  id: string;
  title: string;
  message: string;
  type: string;
  targetRole: 'admin' | 'student';
  targetStudentId?: string;
}): Promise<void> {
  try {
    await setDoc(doc(db, 'pushQueue', notif.id), {
      ...notif,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[FCM] Failed to enqueue push notification:', err);
  }
}

/**
 * Fetch all tokens matching a target (admin OR a specific student).
 * Exposed for the admin settings debug panel.
 */
export async function getRegisteredTokens(role: 'admin' | 'student', studentId?: string) {
  let q;
  if (role === 'admin') {
    q = query(collection(db, TOKENS_COLLECTION), where('role', '==', 'admin'));
  } else {
    q = query(
      collection(db, TOKENS_COLLECTION),
      where('role', '==', 'student'),
      where('studentId', '==', studentId || '__none__')
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as { token: string; platform: string; createdAt: string });
}
