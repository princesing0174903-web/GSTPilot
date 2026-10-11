const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

code = code.replace(
  /setLocalError\('This email is already associated/g,
  `setLocalError('ACCOUNT_LINK_REQUIRED: This email is already associated`
);

code = code.replace(
  /setLocalError\(err\.message \|\| 'Authentication failed'\);/g,
  `setLocalError('AUTH_EXCEPTION: ' + (err.message || 'Authentication failed'));`
);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
