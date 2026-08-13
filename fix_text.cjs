const fs = require('fs');

let content = fs.readFileSync('src/components/admin/AdminVideoCall.tsx', 'utf8');
content = content.replace(/Google Meet, WebRTC, or Jitsi/g, 'Google Meet or WebRTC');
fs.writeFileSync('src/components/admin/AdminVideoCall.tsx', content);

content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');
content = content.replace(/Google Meet, WebRTC, or Jitsi/g, 'Google Meet or WebRTC');
content = content.replace(/3\. In-App WebRTC & Jitsi Meet options\./g, '3. In-App WebRTC options.');
content = content.replace(/Google Meet or Jitsi/g, 'Google Meet');
content = content.replace(/platform === "jitsi" \? "Jitsi" : /g, '');
content = content.replace(/platform ==="jitsi" \?"Jitsi" :/g, '');
fs.writeFileSync('src/components/LiveClasses.tsx', content);

