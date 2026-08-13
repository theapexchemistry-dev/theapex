const fs = require('fs');
let content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');

content = content.replace(/function JoinModal\(\[\s\S]*?\}\n\)\n/g, '');

const regex = /function JoinModal\([\s\S]*?^export default/m;

// Just remove it if it exists.
let modified = content;
const match = modified.match(/function JoinModal\([\s\S]*?\nexport default LiveClasses;/);
if (match) {
   modified = modified.replace(match[0], 'export default LiveClasses;');
   fs.writeFileSync('src/components/LiveClasses.tsx', modified);
}

