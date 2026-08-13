const fs = require('fs');
let meta = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
meta.requestFramePermissions = ["camera", "microphone"];
fs.writeFileSync('metadata.json', JSON.stringify(meta, null, 2));
