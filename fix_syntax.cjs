const fs = require('fs');

let content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');

// fix broken statements
content = content.replace(/meeting\."WebRTC"/g, '"WebRTC"');
content = content.replace(/meeting\."In-App Video"/g, '"In-App Video"');

fs.writeFileSync('src/components/LiveClasses.tsx', content);
