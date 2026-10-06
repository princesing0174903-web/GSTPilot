const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

code = code.replace(
  "setError('GitHub sign-in failed. Please try again.');",
  "setError('GitHub sign-in failed [' + githubError + ']. Please try again.');"
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
console.log('done');
