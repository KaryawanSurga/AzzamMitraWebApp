import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerEvent } from "./observability";

describe("logServerEvent", () => {
  afterEach(() => vi.restoreAllMocks());

  it("menulis log terstruktur dengan level yang tepat", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logServerEvent("info", "sale.confirmed", { saleId: "sale-1" });
    logServerEvent("error", "repository.unavailable", { message: "connection refused" });
    expect(JSON.parse(info.mock.calls[0][0] as string)).toMatchObject({ level: "info", event: "sale.confirmed", saleId: "sale-1" });
    expect(JSON.parse(error.mock.calls[0][0] as string)).toMatchObject({ level: "error", event: "repository.unavailable" });
  });

  it("membuang field sensitif dari log", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logServerEvent("error", "auth.failed", { email: "owner@example.com", password: "rahasia", serviceRoleKey: "secret", reason: "invalid" });
    const logged = JSON.parse(error.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ email: "owner@example.com", reason: "invalid" });
    expect(logged).not.toHaveProperty("password");
    expect(logged).not.toHaveProperty("serviceRoleKey");
  });
});
