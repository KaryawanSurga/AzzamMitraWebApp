import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("pwa manifest", () => {
  it("mendeklarasikan aplikasi standalone dengan ikon install dan maskable", () => {
    const data = manifest();
    expect(data).toMatchObject({
      name: expect.stringContaining("Azzam Mitra"),
      short_name: "Azzam Mitra",
      display: "standalone",
      start_url: "/dashboard",
      theme_color: "#24462C",
      background_color: "#F6F4EE",
    });
    expect(data.icons?.map((icon) => [icon.sizes, icon.purpose ?? "any"])).toEqual([
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ]);
  });
});
