import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "./error";

describe("loginErrorMessage", () => {
  it("hanya menyalahkan kredensial untuk invalid_credentials", () => {
    expect(loginErrorMessage({ code: "invalid_credentials", status: 400 })).toContain("kata sandi salah");
  });

  it("menjelaskan rate limit tanpa menyebut sandi salah", () => {
    const message = loginErrorMessage({ code: "over_request_rate_limit", status: 429 });
    expect(message).toContain("Terlalu banyak percobaan");
    expect(message).not.toContain("sandi salah");
  });

  it("mengarahkan pemeriksaan Supabase untuk kegagalan layanan", () => {
    const message = loginErrorMessage({ code: "unexpected_failure", status: 503 });
    expect(message).toContain("koneksi Supabase");
    expect(message).not.toContain("sandi salah");
  });
});
