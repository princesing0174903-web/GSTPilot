const fs = require('fs');

const fixFile = (file) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/resolveOrgFromHeaders\(req\)/g, "req.headers.get('x-gstpilot-orgid')");
    content = content.replace(/resolveOrgFromHeaders\(request\)/g, "request.headers.get('x-gstpilot-orgid')");
    content = content.replace(/import \{[^}]*resolveOrgFromHeaders[^}]*\} from ['"]@\/lib\/integrations\/(google|zoho(-books)?)\/(auth|oauth)['"];?/g, (match) => {
      let replaced = match.replace('resolveOrgFromHeaders,', '').replace('resolveOrgFromHeaders', '');
      if (replaced.match(/import\s*\{\s*\}\s*from/)) return '';
      return replaced;
    });
    fs.writeFileSync(file, content);
  }
}

const files = [
  "src/app/api/integrations/google/calendar/events/route.ts",
  "src/app/api/integrations/google/connect/route.ts",
  "src/app/api/integrations/google/disconnect/route.ts",
  "src/app/api/integrations/google/drive/route.ts",
  "src/app/api/integrations/google/gmail/route.ts",
  "src/app/api/integrations/google/status/route.ts",
  "src/app/api/integrations/zoho/bills/route.ts",
  "src/app/api/integrations/zoho/connect/route.ts",
  "src/app/api/integrations/zoho/customers/[id]/route.ts",
  "src/app/api/integrations/zoho/customers/auto-sync/route.ts",
  "src/app/api/integrations/zoho/customers/route.ts",
  "src/app/api/integrations/zoho/customers/sync-status/route.ts",
  "src/app/api/integrations/zoho/customers/sync/route.ts",
  "src/app/api/integrations/zoho/diagnostics/route.ts",
  "src/app/api/integrations/zoho/disconnect/route.ts",
  "src/app/api/integrations/zoho/invoices/route.ts",
  "src/app/api/integrations/zoho/organizations/route.ts",
  "src/app/api/integrations/zoho/organizations/select/route.ts",
  "src/app/api/integrations/zoho/payments/route.ts",
  "src/app/api/integrations/zoho/refresh/route.ts",
  "src/app/api/integrations/zoho/status/route.ts",
  "src/app/api/integrations/zoho/sync/route.ts",
  "src/app/api/integrations/zoho/sync/status/route.ts"
];

files.forEach(fixFile);
console.log("Fixed exports");
