const fs = require('fs');
let meta = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
if (!meta.requestFramePermissions.includes("display-capture")) {
  meta.requestFramePermissions.push("display-capture");
}
fs.writeFileSync('metadata.json', JSON.stringify(meta, null, 2));
