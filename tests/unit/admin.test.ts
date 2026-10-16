import { describe, expect, it } from "vitest";
import { isValidAdminUsername, newAdminEmail } from "@/lib/admin";

describe("admin usernames", () => {
  it("rejects usernames that could break lookups", () => {
    for (const bad of ["", "a", "a b", "x@y", "-lead", "a".repeat(40)]) expect(isValidAdminUsername(bad)).toBe(false);
    expect(isValidAdminUsername("Some-User")).toBe(true);
  });
});

// Safety review: the sign-in email used to be "<username>@admin.kittora.internal",
// so anyone who guessed a username could brute-force the public Auth endpoint
// directly and skip the admin-login rate limit.
describe("newAdminEmail", () => {
  it("can't be derived from the username and never repeats", () => {
    const a = newAdminEmail();
    const b = newAdminEmail();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^a-[0-9a-f]{32}@admin\.kittora\.internal$/);
  });
});
