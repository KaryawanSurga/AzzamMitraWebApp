import { describe, expect, it } from "vitest";
import { authRedirectFor, safeInternalRedirect } from "./redirect";

describe("safeInternalRedirect", () => {
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)"])("menolak redirect eksternal %s", (value) => expect(safeInternalRedirect(value)).toBe("/dashboard"));
  it("mempertahankan path, query, dan hash internal", () => expect(safeInternalRedirect("/dashboard?tab=owner#main")).toBe("/dashboard?tab=owner#main"));
});

describe("authRedirectFor", () => {
  it("mengarahkan dashboard anonim ke login", () => expect(authRedirectFor("/dashboard", false)).toBe("/login?next=%2Fdashboard"));
  it("mengarahkan user aktif dari login", () => expect(authRedirectFor("/login", true)).toBe("/dashboard"));
  it("tidak mengubah request valid", () => expect(authRedirectFor("/dashboard", true)).toBeNull());
  it("melindungi route internal berikutnya secara default", () => expect(authRedirectFor("/penjualan", false)).toBe("/login?next=%2Fpenjualan"));
  it("membiarkan callback dan forgot-password tetap publik", () => { expect(authRedirectFor("/auth/callback", false)).toBeNull(); expect(authRedirectFor("/forgot-password", false)).toBeNull(); });
});
