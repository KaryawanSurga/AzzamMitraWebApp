import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { authorizeOwner } from "./owner";

const authenticatedUser = { id: "2d1bfaa4-833b-44ae-b98d-494f05e2178d" } as User;

describe("owner authorization", () => {
  it("authorizes an authenticated identity with a provisioned owner profile", async () => {
    const profile = { id: authenticatedUser.id, email: "owner@example.test", display_name: "Owner" };
    await expect(authorizeOwner(authenticatedUser, vi.fn().mockResolvedValue(profile))).resolves.toEqual(profile);
  });

  it("denies an authenticated but unprovisioned Supabase identity", async () => {
    await expect(authorizeOwner(authenticatedUser, vi.fn().mockResolvedValue(null))).resolves.toBeNull();
  });

  it("does not query profiles for an anonymous request", async () => {
    const lookup = vi.fn();
    await expect(authorizeOwner(null, lookup)).resolves.toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});
