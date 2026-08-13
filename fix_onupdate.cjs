const fs = require('fs');

let content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');

// Admin side
content = content.replace(
  /<PastMeetingCard key=\{m\.id\} meeting=\{m\} isAdmin onDelete=\{\(\) => handleDeleteMeeting\(m\.id\)\} \/>/g,
  '<PastMeetingCard key={m.id} meeting={m} isAdmin onDelete={() => handleDeleteMeeting(m.id)} onUpdate={fbUpdateMeeting} />'
);

fs.writeFileSync('src/components/LiveClasses.tsx', content);
