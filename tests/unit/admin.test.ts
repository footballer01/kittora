import { describe, expect, it } from "vitest";
import { adminEmail, isValidAdminUsername } from "@/lib/admin";

describe("adminEmail", () => {
  it("lowercases and trims the username", () => {
    expect(adminEmail("  Some-User ")).toBe("some-user@admin.kittora.internal");
  });

  it("is the same for any casing", () => {
    expect(adminEmail("ABC")).toBe(adminEmail("abc"));
  });

  it("rejects usernames that could break the address", () => {
    for (const bad of ["", "a", "a b", "x@y", "-lead", "a".repeat(40)]) {
      expect(isValidAdminUsername(bad)).toBe(false);
      expect(() => adminEmail(bad)).toThrow();
    }
  });
});
