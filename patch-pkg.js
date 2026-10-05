const fs = require('fs');
const filepath = 'package.json';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(
  /"dev": "bash auto-restore\.sh && NODE_OPTIONS='--max-old-space-size=3072' npx next dev -p 3000 --webpack"/,
  `"dev": "prisma generate && NODE_OPTIONS='--max-old-space-size=3072' npx next dev -p 3000 --webpack"`
);

fs.writeFileSync(filepath, content);
console.log('Patched', filepath);
