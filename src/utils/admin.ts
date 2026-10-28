/**
 * Administrator Authentication & Permission Utilities
 */

export const ADMIN_EMAILS: string[] = [
  'miroslav87@gmail.com',
  'snapmire@gmail.com'
];

/**
 * Check if the given user email has administrator privileges
 */
export function isAdminUser(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((adm) => adm.toLowerCase() === clean);
}
