const fs = require('fs');
let code = fs.readFileSync('src/app/api/auth/github/session/route.ts', 'utf8');

const target = `import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/integrations/github/session';`;

const replace = `import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/integrations/github/session';`;

code = code.replace(target, replace);

const targetGet = `export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const jwtCookie = parseCookie(cookieHeader).get('gstpilot_session_jwt');`;

const replaceGet = `export async function GET(req: Request) {
  const cookieStore = cookies();
  const jwtCookie = cookieStore.get('gstpilot_session_jwt')?.value;`;

code = code.replace(targetGet, replaceGet);

fs.writeFileSync('src/app/api/auth/github/session/route.ts', code);
console.log('done session route');
