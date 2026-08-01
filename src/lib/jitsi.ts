// Jitsi Meet helper — opens meetings in a new browser tab
// (Embedded iframes on meet.jit.si are limited to 5 minutes;
//  opening in a new tab has NO time limit and is still free.)

export interface JitsiOptions {
  roomName: string;
  displayName: string;
}

export function openJitsiMeeting(options: JitsiOptions): void {
  const safeName = encodeURIComponent(options.displayName);
  const url = `https://meet.jit.si/${options.roomName}#userInfo.displayName=%22${safeName}%22&config.prejoinPageEnabled=false`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
