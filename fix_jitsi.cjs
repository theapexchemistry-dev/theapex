const fs = require('fs');

function cleanLiveClasses() {
  let content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');

  // Remove buildJitsiUrl function completely
  content = content.replace(/function buildJitsiUrl[\s\S]*?return \`https:\/\/meet\.jit\.si\/\$\{safe\}#config\.displayName=\$\{user\}&config\.startWithAudioMuted=true&config\.startWithVideoMuted=false\`\s*\n\}/g, '');
  content = content.replace(/function buildJitsiUrl[\s\S]*?return `https:\/\/meet\.jit\.si.*?\n\}/gs, '');

  // Modify platform state
  content = content.replace(/const \[platform, setPlatform\] = useState<"google_meet" \|"webrtc" \|"jitsi">/g, 'const [platform, setPlatform] = useState<"google_meet" | "webrtc">');
  content = content.replace(/const \[platform, setPlatform\] = useState<"google_meet" \| "webrtc" \| "jitsi">/g, 'const [platform, setPlatform] = useState<"google_meet" | "webrtc">');

  // Remove auto-launch logic for Jitsi
  content = content.replace(/} else if \(platform ==="jitsi"\) \{\s*const jitsiUrl = buildJitsiUrl[\s\S]*?opened = false; \}\s*\}/g, '}');

  // Remove Jitsi button in Platform Selector
  content = content.replace(/<button\s*type="button"\s*onClick=\{\(\) => setPlatform\("jitsi"\)\}[\s\S]*?Jitsi Meet\s*<\/button>/g, '');

  // Remove Jitsi from submit button text
  content = content.replace(/platform === "jitsi" \? "Jitsi" : "WebRTC"/g, '"WebRTC"');
  content = content.replace(/platform ==="jitsi" \?"Jitsi" :"WebRTC"/g, '"WebRTC"');
  content = content.replace(/platform === "jitsi" \? "Jitsi Meet" : "In-App Video"/g, '"In-App Video"');
  content = content.replace(/platform ==="jitsi" \?"Jitsi Meet" :"In-App Video"/g, '"In-App Video"');

  // Remove from meeting cards
  content = content.replace(/meeting\.platform === "jitsi" \? "Jitsi" : "WebRTC"/g, '"WebRTC"');
  content = content.replace(/meeting\.platform ==="jitsi" \?"Jitsi" :"WebRTC"/g, '"WebRTC"');
  content = content.replace(/meeting\.platform === "jitsi" \? "Jitsi Meet" : "In-App Video"/g, '"In-App Video"');
  content = content.replace(/meeting\.platform ==="jitsi" \?"Jitsi Meet" :"In-App Video"/g, '"In-App Video"');

  // Remove Jitsi logic from JoinModal
  content = content.replace(/const jitsiUrl = buildJitsiUrl\(meeting\.roomName, displayName\);\s*/g, '');
  content = content.replace(/const finalUrl = isMeet \? meetUrl : jitsiUrl;/g, 'const finalUrl = meetUrl;');

  fs.writeFileSync('src/components/LiveClasses.tsx', content);
}

function cleanTypes() {
  const files = ['src/lib/firebaseSync.ts', 'src/lib/useLiveClass.ts'];
  for (const file of files) {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      content = content.replace(/platform\?: "google_meet" \| "webrtc" \| "jitsi";/g, 'platform?: "google_meet" | "webrtc";');
      content = content.replace(/platform\?: "google_meet" \|"webrtc" \|"jitsi";/g, 'platform?: "google_meet" | "webrtc";');
      fs.writeFileSync(file, content);
    }
  }
}

cleanLiveClasses();
cleanTypes();
