const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

// We want to capture the raw error if possible, but AuthContext masks it via friendlyAuthError.
// Actually, I'll just change the localError to append a little debugging info if it's the specific string.
code = code.replace(
  `setLocalError(result.error);`,
  `setLocalError("GOOGLE_SIGN_IN_ERROR: " + result.error);`
);

code = code.replace(
  `setLocalError(res.error);`,
  `setLocalError("EMAIL_SIGN_IN_ERROR: " + res.error);`
);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
