const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

code = code.replace(`          </div>\r\n          )}\r\n          )}`, `          </div>\r\n          )}`);
code = code.replace(`          </div>\n          )}\n          )}`, `          </div>\n          )}`);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
