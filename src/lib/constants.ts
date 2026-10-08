// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Shared Constants
// Single source of truth for Indian states, GST sections, filing dates, etc.
// ═══════════════════════════════════════════════════════════════════════════════

export const INDIAN_STATES = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' },
  { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
  // Union Territories
  { name: 'Andaman and Nicobar Islands', code: '35' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
  { name: 'Delhi', code: '07' },
  { name: 'Jammu & Kashmir', code: '01' },
  { name: 'Ladakh', code: '38' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Puducherry', code: '34' },
] as const;

export const ENTITY_TYPES = [
  'Proprietorship',
  'Partnership',
  'LLP',
  'Pvt Ltd',
  'Ltd',
  'Other',
] as const;

export const CURRENT_PERIOD = '2025-06';
export const CURRENT_FINANCIAL_YEAR = '2025-26';

export const FILING_DUE_DATES: Record<string, { monthly: number; quarterly: number }> = {
  'GSTR-1': { monthly: 11, quarterly: 13 },
  'GSTR-3B': { monthly: 20, quarterly: 22 },
};

export const GSTR1_SECTIONS = [
  { key: 'b2b', label: 'B2B Invoices', description: 'Supplies to registered dealers' },
  { key: 'b2cl', label: 'B2C Large', description: 'Inter-state supplies above ₹2.5L' },
  { key: 'b2cs', label: 'B2C Small', description: 'Intra-state or below ₹2.5L' },
  { key: 'exp', label: 'Exports', description: 'Zero-rated supplies' },
  { key: 'cdnr', label: 'Credit/Debit Notes (Registered)', description: 'CDN to registered dealers' },
  { key: 'cdnur', label: 'Credit/Debit Notes (Unregistered)', description: 'CDN to unregistered dealers' },
  { key: 'nil', label: 'Nil Rated/Exempted', description: 'Nil-rated, exempted, non-GST supplies' },
  { key: 'hsn', label: 'HSN Summary', description: 'HSN/SAC wise summary' },
] as const;

export const GSTR1_SECTION_LABELS: Record<string, string> = Object.fromEntries(
  GSTR1_SECTIONS.map((s) => [s.key, s.label])
);

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full access to all features, team management, and firm settings',
  manager: 'Can manage clients, returns, and reconciliation. Limited firm settings.',
  staff: 'Can view and prepare returns and documents. No delete or filing access.',
};

export const PERMISSIONS = {
  admin: {
    clients: ['create', 'read', 'update', 'delete'],
    documents: ['create', 'read', 'update', 'delete'],
    returns: ['create', 'read', 'update', 'file', 'delete'],
    reconciliation: ['create', 'read', 'update', 'delete'],
    team: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update'],
    audit: ['read'],
  },
  manager: {
    clients: ['create', 'read', 'update'],
    documents: ['create', 'read', 'update'],
    returns: ['create', 'read', 'update', 'file'],
    reconciliation: ['create', 'read', 'update'],
    team: ['read'],
    settings: ['read'],
    audit: ['read'],
  },
  staff: {
    clients: ['read'],
    documents: ['create', 'read'],
    returns: ['create', 'read', 'update'],
    reconciliation: ['read'],
    team: [],
    settings: [],
    audit: [],
  },
} as const;

export type PermissionEntity = keyof typeof PERMISSIONS.admin;
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'file';

export function hasPermission(
  role: string,
  entity: PermissionEntity,
  action: PermissionAction
): boolean {
  const perms = PERMISSIONS[role as keyof typeof PERMISSIONS];
  if (!perms) return false;
  return (perms[entity] as readonly string[]).includes(action);
}
