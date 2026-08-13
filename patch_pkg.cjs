const fs = require('fs');

let content = fs.readFileSync('package.json', 'utf8');
const pkg = JSON.parse(content);
pkg.scripts.dev = "tsx server.ts";
pkg.scripts.build = "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs";
pkg.scripts.start = "node dist/server.cjs";
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

