import os
import re

directories = ['src/app/api/integrations', 'src/app/api/connect']

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'resolveOrgUserFromHeaders' not in content:
        return

    # 1. Update imports
    content = content.replace('resolveOrgUserFromHeaders', 'resolveOrgFromHeaders')
    
    # 2. Add requireOrgMembership import if requireAuth is imported from session.ts
    if 'requireAuth' in content and 'requireOrgMembership' not in content:
        content = re.sub(r'(import \{[^}]*?requireAuth[^}]*?\})', r'\1', content)
        # Fix the import properly:
        content = re.sub(r'import\s*\{\s*(.*?requireAuth.*?)\s*\}\s*from\s*[\'"]@/lib/auth/session[\'"];', 
                         r'import { \1, requireOrgMembership } from "@/lib/auth/session";', content)

    # 3. Add requireAuth and requireOrgMembership imports if they don't exist
    if 'requireAuth' not in content:
        content = re.sub(r'(import \{ NextResponse \} from \'next/server\';)', 
                         r'\1\nimport { requireAuth, requireOrgMembership } from "@/lib/auth/session";', content)

    # 4. Inject requireAuth check into function bodies if missing
    def inject_auth(match):
        func_def = match.group(1)
        # If it doesn't have authResult = await requireAuth
        body = content[match.end():match.end()+200]
        if 'await requireAuth' not in body:
            return f"{func_def}\n  const authResult = await requireAuth(req);\n  if (authResult instanceof NextResponse) return authResult;\n"
        return func_def
    
    content = re.sub(r'(export async function (?:GET|POST|PATCH|DELETE)\(req: Request\) \{)', inject_auth, content)
    content = re.sub(r'(export async function (?:GET|POST|PATCH|DELETE)\(request: Request\) \{)', lambda m: inject_auth(m).replace('req)', 'request)'), content)

    # 5. Fix the destructuring
    # From: const { orgId, userId } = resolveOrgFromHeaders(req);
    # To:
    # const orgId = resolveOrgFromHeaders(req);
    # const userId = authResult.uid;
    # const memberResult = await requireOrgMembership(userId, orgId);
    # if (memberResult instanceof NextResponse) return memberResult;
    
    def fix_destructure(match):
        req_var = match.group(1)
        return (f"const orgId = resolveOrgFromHeaders({req_var});\n"
                f"  const userId = authResult.uid;\n"
                f"  const memberResult = await requireOrgMembership(userId, orgId);\n"
                f"  if (memberResult instanceof NextResponse) return memberResult;")
                
    content = re.sub(r'const\s+\{\s*orgId\s*,\s*userId(?:,\s*userEmail)?\s*\}\s*=\s*resolveOrgFromHeaders\((.*?)\);', fix_destructure, content)
    
    # 6. Fix the if check
    content = re.sub(r'if\s*\(\s*!orgId\s*\|\|\s*!userId\s*\)', 'if (!orgId)', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched {filepath}")

for d in directories:
    if os.path.exists(d):
        for root, dirs, files in os.walk(d):
            for file in files:
                if file.endswith('.ts') or file.endswith('.tsx'):
                    process_file(os.path.join(root, file))
