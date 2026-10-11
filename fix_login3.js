const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

code = code.replace(/{!linkEmail && \(\s*{!linkEmail && \(/g, '{!linkEmail && (');

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
