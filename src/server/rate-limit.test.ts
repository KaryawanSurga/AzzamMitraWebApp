import { beforeEach, describe, expect, it } from "vitest";
import type { OwnerProfile } from "@/lib/auth/owner";
import { consumeRateLimit, limitOwnerMutation, resetRateLimits } from "./rate-limit";

const owner: OwnerProfile = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "owner@example.com", display_name: "Owner" };
const start = 1_000_000;

describe("rate limit", () => {
  beforeEach(() => resetRateLimits());

  it("mengizinkan sampai batas lalu menolak dengan sisa waktu", () => {
    expect(consumeRateLimit("login", 2, 60_000, start)).toEqual({ allowed: true });
    expect(consumeRateLimit("login", 2, 60_000, start + 1)).toEqual({ allowed: true });
    expect(consumeRateLimit("login", 2, 60_000, start + 2)).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });

  it("membuka blokir setelah jendela waktu lewat", () => {
    consumeRateLimit("payment", 1, 1_000, start);
    expect(consumeRateLimit("payment", 1, 1_000, start + 500)).toMatchObject({ allowed: false });
    expect(consumeRateLimit("payment", 1, 1_000, start + 1_000)).toEqual({ allowed: true });
  });

  it("memisahkan bucket per owner dan per aksi", () => {
    const other = { ...owner, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
    expect(limitOwnerMutation(owner, "sale.create", 1)).toBeNull();
    expect(limitOwnerMutation(owner, "sale.create", 1)).toMatchObject({ ok: false, error: { code: "retryable" } });
    expect(limitOwnerMutation(owner, "sale.cancel", 1)).toBeNull();
    expect(limitOwnerMutation(other, "sale.create", 1)).toBeNull();
  });

  it("tidak membatasi ketika sesi tidak ada karena otorisasi ditangani service", () => {
    expect(limitOwnerMutation(null, "sale.create", 1)).toBeNull();
  });
});
