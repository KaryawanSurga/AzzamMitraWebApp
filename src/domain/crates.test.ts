import { describe, expect, it } from "vitest";
import { dateSchema, milliToQuantity, quantityToMilli, uuidSchema } from "./contracts";
import { deriveCrateBalanceMilli, sumCrateMilli, validateCrateReturn } from "./crates";

describe("konversi kuantitas", () => {
  it("menjaga nilai mili bolak-balik tanpa kehilangan presisi", () => {
    for (const value of ["4", "0.5", "10.25", "103.125"]) {
      expect(milliToQuantity(quantityToMilli(value))).toBe(value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1"));
    }
    expect(milliToQuantity(quantityToMilli("10"))).toBe("10");
    expect(milliToQuantity(quantityToMilli("0.5"))).toBe("0.5");
  });

  it("menolak kuantitas dengan lebih dari tiga angka desimal", () => {
    expect(quantityToMilli("1.5")).toBe(1500);
    expect(() => quantityToMilli("1.0001")).toThrow();
  });
});

describe("saldo peti", () => {
  it("mengurangi saldo hanya dari peti kembali dan mengabaikan adjustment", () => {
    const balance = deriveCrateBalanceMilli([
      { type: "out", crateQuantityMilli: 10000 },
      { type: "return", crateQuantityMilli: 6000 },
      { type: "adjustment", crateQuantityMilli: 2000 },
    ]);
    expect(balance).toBe(4000);
    expect(deriveCrateBalanceMilli([])).toBe(0);
  });

  it("menjumlahkan peti pada item penjualan dan melewati item tanpa peti", () => {
    expect(sumCrateMilli([{ crateQuantity: "10" }, { crateQuantity: null }, { crateQuantity: "0.5" }])).toBe(10500);
    expect(sumCrateMilli([])).toBe(0);
  });

  it("menolak pengembalian yang melebihi saldo dan mengizinkan pengembalian tepat sebesar saldo", () => {
    expect(validateCrateReturn(4000, 6000)).toBe("Pengembalian melebihi saldo peti pelanggan (4 peti).");
    expect(validateCrateReturn(4000, 4000)).toBeNull();
    expect(validateCrateReturn(4000, 0)).toBe("Jumlah peti yang dikembalikan harus lebih dari nol.");
  });
});

describe("primitif kontrak", () => {
  it("memvalidasi tanggal kalender dan UUID", () => {
    expect(dateSchema.safeParse("2026-02-29").success).toBe(false);
    expect(dateSchema.safeParse("2024-02-29").success).toBe(true);
    expect(uuidSchema.safeParse("11111111-1111-4111-8111-111111111111").success).toBe(true);
    expect(uuidSchema.safeParse("bukan-uuid").success).toBe(false);
  });
});
