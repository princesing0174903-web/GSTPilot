const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

schema = schema.replace(
  'url      = env("DATABASE_URL")',
  'url      = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")'
);

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('done schema');
