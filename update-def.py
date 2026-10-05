import os
import re

files = [
    'src/lib/google-workspace/auth.ts',
    'src/lib/integrations/zoho-books/oauth.ts',
    'src/lib/integrations/zoho/oauth.ts' # Check both locations just in case
]

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace the signature and implementation of resolveOrgUserFromHeaders
    # with resolveOrgFromHeaders
    content = re.sub(
        r'export function resolveOrgUserFromHeaders\(req: Request\)[^{]*\{.*?return\s*\{.*?\}\s*;\s*\}',
        r'''export function resolveOrgFromHeaders(req: Request): string | null {
  return req.headers.get('x-gstpilot-orgid')?.trim() || null;
}''',
        content,
        flags=re.DOTALL
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated definition in {filepath}")
