// Admins sign in with a username; Supabase Auth needs an email, so each admin
// maps to a placeholder address on a domain that can never receive mail.
export const ADMIN_EMAIL_DOMAIN = "admin.kittora.internal";

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,30}$/i;

export function isValidAdminUsername(username: string): boolean {
  return USERNAME.test(username.trim());
}

export function adminEmail(username: string): string {
  const u = username.trim();
  if (!isValidAdminUsername(u)) throw new Error("Invalid admin username");
  return `${u.toLowerCase()}@${ADMIN_EMAIL_DOMAIN}`;
}
