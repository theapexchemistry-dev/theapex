import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/gmail.send');

let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;
let authInProgress: 'popup' | 'redirect' | null = null;

// ---------- Redirect result handling (called once on app boot) ----------
export const handleRedirectResult = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        cachedUser = result.user;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('apex_auth_complete'));
        }
        return { user: result.user, accessToken: cachedAccessToken };
      }
    }
    return null;
  } catch (error: any) {
    console.error('Redirect result error:', error);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('apex_auth_error', { detail: error?.message || 'Auth failed' }));
    }
    throw error;
  }
};

// ---------- Pop-up based sign-in (desktop-friendly) ----------
export const googleSignInWithPopup = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    authInProgress = 'popup';
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_auth_complete'));
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Popup sign-in error:', error);
    throw error;
  } finally {
    authInProgress = null;
  }
};

// ---------- Redirect-based sign-in (mobile / popup-blocked fallback) ----------
export const googleSignInWithRedirect = async (): Promise<void> => {
  try {
    authInProgress = 'redirect';
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('Redirect sign-in error:', error);
    authInProgress = null;
    throw error;
  }
};

// ---------- Smart sign-in: tries popup, falls back to redirect ----------
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  if (cachedAccessToken && cachedUser) {
    return { user: cachedUser, accessToken: cachedAccessToken };
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  if (isMobile) {
    await googleSignInWithRedirect();
    return null;
  }

  try {
    return await googleSignInWithPopup();
  } catch (err: any) {
    if (
      err?.code === 'auth/popup-blocked' ||
      err?.code === 'auth/popup-closed-by-user' ||
      err?.code === 'auth/cancelled-popup-request'
    ) {
      console.warn('Popup blocked, falling back to redirect...');
      await googleSignInWithRedirect();
      return null;
    }
    throw err;
  }
};

// ---------- Synchronous token check (preserves user gesture) ----------
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const isAuthenticated = (): boolean => {
  return cachedAccessToken !== null;
};

export const getCurrentUser = (): User | null => {
  return cachedUser;
};

export const signOutGoogle = async (): Promise<void> => {
  try {
    await auth.signOut();
  } catch (e) {
    // ignore
  }
  cachedAccessToken = null;
  cachedUser = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('apex_auth_changed'));
  }
};

function stringToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createMimeMessage(
  to: string,
  subject: string,
  bodyHtml: string,
  attachment?: { filename: string; content: string; mimeType: string }
): string {
  const boundary = `boundary_${Date.now().toString(16)}`;
  let messageParts: string[] = [];

  if (attachment) {
    const pureBase64 = attachment.content.replace(/^data:.*?;base64,/, '');
    messageParts = [
      `To: ${to}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      bodyHtml,
      ``,
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      pureBase64,
      ``,
      `--${boundary}--`
    ];
  } else {
    messageParts = [
      `To: ${to}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      ``,
      bodyHtml
    ];
  }

  const message = messageParts.join('\r\n');
  return stringToBase64Url(message);
}

export const sendEmailViaGmail = async (
  to: string,
  subject: string,
  bodyHtml: string,
  attachment?: { filename: string; content: string; mimeType: string },
  existingToken?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const token = existingToken || cachedAccessToken;
    if (!token) {
      return {
        success: false,
        error: 'Google authentication required. Please click "Connect Gmail Account" first.'
      };
    }

    const rawMessage = createMimeMessage(to, subject, bodyHtml, attachment);

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: rawMessage })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.error?.message || `Gmail API returned HTTP ${response.status}`;
      if (response.status === 401) {
        cachedAccessToken = null;
      }
      return { success: false, error: msg };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to send email via Gmail:', err);
    return { success: false, error: err.message || 'Failed to send email' };
  }
};
