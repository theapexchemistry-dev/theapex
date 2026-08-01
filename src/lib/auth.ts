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

// Event names
const AUTH_COMPLETE_EVENT = 'apex_auth_complete';
const AUTH_ERROR_EVENT = 'apex_auth_error';

// localStorage keys for token persistence (survives page reloads)
const TOKEN_KEY = 'apex_gmail_token';
const TOKEN_EXPIRY_KEY = 'apex_gmail_token_expiry';
const USER_EMAIL_KEY = 'apex_gmail_user_email';
const USER_NAME_KEY = 'apex_gmail_user_name';

// Google OAuth access tokens last 1 hour — we use 55 min for safety
const TOKEN_LIFETIME_MS = 55 * 60 * 1000;

let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

// ---------- Restore token from localStorage on module load ----------
const restoreTokenFromStorage = (): void => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (token && expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      if (Date.now() < expiry) {
        cachedAccessToken = token;
      } else {
        clearPersistedToken();
      }
    }
  } catch (e) {
    // ignore
  }
};

// Run restoration immediately (browser only)
if (typeof window !== 'undefined') {
  restoreTokenFromStorage();
}

const persistToken = (token: string, userEmail?: string, userName?: string): void => {
  try {
    const expiry = Date.now() + TOKEN_LIFETIME_MS;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
    if (userEmail) localStorage.setItem(USER_EMAIL_KEY, userEmail);
    if (userName) localStorage.setItem(USER_NAME_KEY, userName);
  } catch (e) {
    // ignore
  }
};

const clearPersistedToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    localStorage.removeItem(USER_NAME_KEY);
  } catch (e) {
    // ignore
  }
};

// ---------- Extract access token from sign-in result (multiple methods) ----------
const extractAccessToken = (result: any): string | null => {
  // Method 1: Standard credentialFromResult
  try {
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      return credential.accessToken;
    }
  } catch (e) {
    // continue to other methods
  }

  // Method 2: Firebase internal _tokenResponse (works when method 1 fails)
  try {
    const tokenResponse = result?._tokenResponse;
    if (tokenResponse?.oauthAccessToken) {
      return tokenResponse.oauthAccessToken;
    }
  } catch (e) {
    // continue
  }

  // Method 3: Check result.user metadata
  try {
    if (result?.user?.stsTokenManager?.accessToken) {
      // This is the Firebase ID token, NOT the Google OAuth token
      // We can't use this for Gmail API, but log it for debugging
      console.warn('Only Firebase ID token available — Gmail API needs OAuth token');
    }
  } catch (e) {
    // ignore
  }

  return null;
};

// ---------- Redirect result handling ----------
export const handleRedirectResult = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const accessToken = extractAccessToken(result);
      if (accessToken) {
        cachedAccessToken = accessToken;
        cachedUser = result.user;
        persistToken(
          accessToken,
          result.user.email || undefined,
          result.user.displayName || undefined
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(AUTH_COMPLETE_EVENT));
        }
        return { user: result.user, accessToken };
      } else {
        console.error('Redirect result — no access token. Full result:', result);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(AUTH_ERROR_EVENT, {
              detail: 'Gmail permission was not granted. Please try again and allow Gmail access.'
            })
          );
        }
      }
    }
    return null;
  } catch (error: any) {
    console.error('Redirect result error:', error);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(AUTH_ERROR_EVENT, { detail: error?.message || 'Auth failed' })
      );
    }
    throw error;
  }
};

// ---------- Pop-up sign-in (desktop) ----------
export const googleSignInWithPopup = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  const result = await signInWithPopup(auth, provider);

  const accessToken = extractAccessToken(result);

  if (!accessToken) {
    console.error(
      'Popup sign-in — could not extract access token. Result keys:',
      Object.keys(result || {}),
      'Token response keys:',
      Object.keys(result?._tokenResponse || {})
    );
    throw new Error(
      'Gmail access token could not be retrieved. Please disconnect any existing Google sign-in and try again.'
    );
  }

  cachedAccessToken = accessToken;
  cachedUser = result.user;
  persistToken(
    accessToken,
    result.user.email || undefined,
    result.user.displayName || undefined
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_COMPLETE_EVENT));
  }
  return { user: result.user, accessToken };
};

// ---------- Redirect sign-in (mobile / popup-blocked fallback) ----------
export const googleSignInWithRedirect = async (): Promise<void> => {
  await signInWithRedirect(auth, provider);
};

// ---------- Smart sign-in ----------
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  // If already cached (in memory or restored from localStorage), return it
  if (cachedAccessToken) {
    // Check if we have a user object, otherwise build a minimal one
    if (cachedUser) {
      return { user: cachedUser, accessToken: cachedAccessToken };
    }
    // Token restored from localStorage but no user object — return minimal
    const email = typeof window !== 'undefined' ? localStorage.getItem(USER_EMAIL_KEY) : null;
    const name = typeof window !== 'undefined' ? localStorage.getItem(USER_NAME_KEY) : null;
    return {
      user: { email: email || '', displayName: name || '' } as User,
      accessToken: cachedAccessToken
    };
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
      console.warn('Popup blocked/closed, falling back to redirect...');
      await googleSignInWithRedirect();
      return null;
    }
    throw err;
  }
};

// ---------- Synchronous token check (preserves user gesture) ----------
export const getAccessToken = (): string | null => {
  // Check memory first
  if (cachedAccessToken) return cachedAccessToken;

  // Check localStorage (in case of page reload)
  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (token && expiryStr) {
        const expiry = parseInt(expiryStr, 10);
        if (Date.now() < expiry) {
          cachedAccessToken = token;
          return token;
        } else {
          clearPersistedToken();
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
};

export const isAuthenticated = (): boolean => {
  return getAccessToken() !== null;
};

export const getConnectedEmail = (): string | null => {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(USER_EMAIL_KEY);
    } catch {
      return null;
    }
  }
  return null;
};

export const signOutGoogle = async (): Promise<void> => {
  try {
    await auth.signOut();
  } catch (e) {
    // ignore
  }
  cachedAccessToken = null;
  cachedUser = null;
  clearPersistedToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('apex_auth_changed'));
  }
};

// ---------- Gmail API helpers ----------
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

  return stringToBase64Url(messageParts.join('\r\n'));
}

export const sendEmailViaGmail = async (
  to: string,
  subject: string,
  bodyHtml: string,
  attachment?: { filename: string; content: string; mimeType: string },
  existingToken?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const token = existingToken || getAccessToken();
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
        // Token expired or invalid — clear it
        cachedAccessToken = null;
        clearPersistedToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('apex_auth_changed'));
        }
      }
      return { success: false, error: msg };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to send email via Gmail:', err);
    return { success: false, error: err.message || 'Failed to send email' };
  }
};
