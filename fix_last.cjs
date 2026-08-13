const fs = require('fs');

let content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');
content = content.replace(/platform ==="webrtc" \?"WebRTC" :"Jitsi"/g, '"WebRTC"');
content = content.replace(/platform === "webrtc" \? "WebRTC" : "Jitsi"/g, '"WebRTC"');
fs.writeFileSync('src/components/LiveClasses.tsx', content);

