const fs = require('fs');
const filepath = 'src/hooks/api.ts';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(
  /if \(err\.status === 401\) \{\s*broadcastSessionExpired\(\);\s*\}/,
  `if (err.status === 401) {
          const code = (err.body as any)?.code;
          if (!code || code === 'SESSION_EXPIRED' || code === 'AUTH_REQUIRED') {
            broadcastSessionExpired();
          }
        }`
);

fs.writeFileSync(filepath, content);
console.log('Patched', filepath);
