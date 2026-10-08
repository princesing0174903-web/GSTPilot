/** VEYRO Global AI App Marketplace™ — Client-safe barrel (Prisma-free).
 *
 * Explicit re-exports of ONLY the Prisma-free modules in this package:
 *   types, catalog, permissions, sdk, ai-builder.
 *
 * Client components should import from `@/lib/app-platform/client` instead of
 * `@/lib/app-platform` to avoid the server barrel (`index.ts`) which uses
 * `export *` from 14 sub-modules (9 of which import Prisma). The full server
 * barrel remains available for API routes and server-side lib modules.
 */

export * from './types';
export * from './catalog';
export * from './permissions';
export * from './sdk';
export * from './ai-builder';
