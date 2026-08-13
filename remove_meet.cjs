const fs = require('fs');

let content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');

// Update state to webrtc default
content = content.replace(/useState<"google_meet" \| "webrtc">/g, 'useState<"webrtc">');
content = content.replace(/useState<"webrtc">\("google_meet"\)/g, 'useState<"webrtc">("webrtc")');

// Remove meetUrl from create payload logic
content = content.replace(/const finalMeetUrl = platform === "google_meet"[\s\S]*?\?\s*customMeetUrl\.trim\(\)\s*:\s*buildGoogleMeetUrl\(roomName\);/g, 'const finalMeetUrl = null;');
content = content.replace(/const finalMeetUrl = platform ==="google_meet"[\s\S]*?\?\s*customMeetUrl\.trim\(\)\s*:\s*buildGoogleMeetUrl\(roomName\);/g, 'const finalMeetUrl = null;');

// Remove Auto-launch Google Meet logic
content = content.replace(/if \(platform === "google_meet" && finalMeetUrl\) \{[\s\S]*?\} else if \(platform === "webrtc"\) \{/g, 'if (platform === "webrtc") {');
content = content.replace(/if \(platform ==="google_meet" && finalMeetUrl\) \{[\s\S]*?\} else if \(platform ==="webrtc"\) \{/g, 'if (platform === "webrtc") {');


// Platform Selector
content = content.replace(/<button[\s\S]*?onClick=\{\(\) => setPlatform\("google_meet"\)\}[\s\S]*?Google Meet[\s\S]*?<\/button>/g, '');
content = content.replace(/<label className="text-xs font-bold uppercase tracking-wider text-slate-500">Class Platform<\/label>\s*<div className="flex flex-col md:flex-row gap-3">[\s\S]*?<\/div>\s*<\/div>/, '');

// Google Meet URL field
content = content.replace(/\{platform === "google_meet" && \([\s\S]*?\}\)/g, '');
content = content.replace(/\{platform ==="google_meet" && \([\s\S]*?\}\)/g, '');

// Remove from buttons
content = content.replace(/\(\{platform === "google_meet" \? "Google Meet" : "WebRTC"\}\)/g, '(WebRTC)');
content = content.replace(/\(\{platform ==="google_meet" \?"Google Meet" : "WebRTC"\}\)/g, '(WebRTC)');

content = content.replace(/isMeet \? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"/g, '"bg-amber-100 text-amber-800"');
content = content.replace(/isMeet \?"bg-emerald-100 text-emerald-800" :"bg-amber-100 text-amber-800"/g, '"bg-amber-100 text-amber-800"');

content = content.replace(/isMeet \? "Google Meet" : "WebRTC"/g, '"WebRTC"');
content = content.replace(/isMeet \?"Google Meet" : "WebRTC"/g, '"WebRTC"');

content = content.replace(/isMeet \? meetUrl : null/g, 'null');
content = content.replace(/isMeet \? meetUrl : null;/g, 'null;');

content = content.replace(/isMeet \? "Google Meet" : meeting\.platform \? meeting\.platform : "In-App Video"/g, '"In-App Video"');
content = content.replace(/isMeet \?"Google Meet" : meeting\."In-App Video"/g, '"In-App Video"');

content = content.replace(/const isMeet = meeting\.platform === "google_meet";/g, 'const isMeet = false;');
content = content.replace(/const isMeet = meeting\.platform ==="google_meet";/g, 'const isMeet = false;');


// Remove buildGoogleMeetUrl
content = content.replace(/function buildGoogleMeetUrl[\s\S]*?return `https:\/\/meet\.google\.com\/new\?[\s\S]*?\}\n/g, '');

// Remove references to Google Meet in text
content = content.replace(/Integrate Google Meet or WebRTC with student auto name configuration/g, 'Start in-app live WebRTC video classes');

fs.writeFileSync('src/components/LiveClasses.tsx', content);

let adminVideoCall = fs.readFileSync('src/components/admin/AdminVideoCall.tsx', 'utf8');
adminVideoCall = adminVideoCall.replace(/Start live classes via Google Meet or WebRTC/g, 'Start live classes via In-App WebRTC');
fs.writeFileSync('src/components/admin/AdminVideoCall.tsx', adminVideoCall);

let fbs = fs.readFileSync('src/lib/firebaseSync.ts', 'utf8');
fbs = fbs.replace(/platform\?: "google_meet" \| "webrtc";/g, 'platform?: "webrtc";');
fs.writeFileSync('src/lib/firebaseSync.ts', fbs);

let ulc = fs.readFileSync('src/lib/useLiveClass.ts', 'utf8');
ulc = ulc.replace(/platform\?: "google_meet" \| "webrtc";/g, 'platform?: "webrtc";');
fs.writeFileSync('src/lib/useLiveClass.ts', ulc);

