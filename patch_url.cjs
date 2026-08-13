const fs = require('fs');

let content = fs.readFileSync('src/lib/useLiveClass.ts', 'utf8');

// Change socket URL to point to current host
content = content.replace(
  /const SOCKET_URL =[\s\S]*?"http:\/\/localhost:3001";/,
  'const SOCKET_URL = "/";'
);

// We should also replace it globally if there are multiple occurrences
fs.writeFileSync('src/lib/useLiveClass.ts', content);

