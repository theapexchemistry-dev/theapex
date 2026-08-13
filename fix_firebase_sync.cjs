const fs = require('fs');

let content = fs.readFileSync('src/lib/firebaseSync.ts', 'utf8');

content = content.replace(
  /const arr = getStoredArray\("live_meetings_v2"\) as LiveMeeting\[\];\s*const updated = arr.map\(\(m\) => \(m.id === meeting.id \? meeting : m\)\);\s*setStoredArray\("live_meetings_v2", updated\);/g,
  `const arr = readLocalMeetings();
  const updated = arr.map((m) => (m.id === meeting.id ? meeting : m));
  writeLocalMeetings(updated);`
);

fs.writeFileSync('src/lib/firebaseSync.ts', content);
