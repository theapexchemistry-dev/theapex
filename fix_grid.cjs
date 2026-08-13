const fs = require('fs');

let content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');
content = content.replace(/grid-cols-1 sm:grid-cols-3 gap-2/g, 'grid-cols-1 sm:grid-cols-2 gap-2');
fs.writeFileSync('src/components/LiveClasses.tsx', content);
