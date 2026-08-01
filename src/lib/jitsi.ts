// Jitsi Meet External API helper
// Loads the Jitsi script and creates embedded video meetings

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadJitsiScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.JitsiMeetExternalAPI) {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window not available'));
      return;
    }
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Jitsi script'));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export interface JitsiOptions {
  roomName: string;
  parentNode: HTMLElement;
  displayName: string;
}

export async function createJitsiMeeting(options: JitsiOptions): Promise<any> {
  await loadJitsiScript();

  const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
    roomName: options.roomName,
    parentNode: options.parentNode,
    userInfo: {
      displayName: options.displayName,
    },
    configOverwrite: {
      startWithAudioMuted: false,
      startWithVideoMuted: false,
      prejoinPageEnabled: false,
      disableDeepLinking: true,
    },
    interfaceConfigOverwrite: {
      TOOLBAR_BUTTONS: [
        'microphone', 'camera', 'desktop', 'chat',
        'raisehand', 'tileview', 'fullscreen', 'hangup'
      ],
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
    },
  });

  return api;
}
