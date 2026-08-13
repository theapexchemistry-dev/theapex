const fs = require('fs');
let content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');

// I'll make sure it looks nice
content = content.replace(/new Date\(meeting\.startedAt\)\.toLocaleString\(\)/g, "new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(meeting.startedAt)");
content = content.replace(/new Date\(meeting\.startedAt\)\.toLocaleDateString\(\)/g, "new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(meeting.startedAt)");
content = content.replace(/new Date\(meeting\.startedAt\)\.toLocaleTimeString\(\)/g, "new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(meeting.startedAt)");

fs.writeFileSync('src/components/LiveClasses.tsx', content);
