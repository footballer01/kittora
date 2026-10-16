// Admins sign in with a username; Supabase Auth needs an email, so each admin
// gets a random placeholder address on a domain that can never receive mail.
// It's random (not derived from the username) because Supabase's password
// endpoint is public: a guessable address would let anyone skip the
// admin-login Edge Function's rate limit. Only that function maps username →
// email, with the service role (admin_login_begin()).
export const ADMIN_EMAIL_DOMAIN = "admin.kittora.internal";

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,30}$/i;

export function isValidAdminUsername(username: string): boolean {
  return USERNAME.test(username.trim());
}

/** A fresh, unguessable sign-in address (128 random bits). */
export function newAdminEmail(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `a-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}@${ADMIN_EMAIL_DOMAIN}`;
}
