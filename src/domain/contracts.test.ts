import { describe, expect, it } from "vitest";
import { decimalQuantitySchema, positiveRupiahSchema, saleItemSnapshotSchema } from "./contracts";

describe("kontrak domain finansial", () => {
  it("menerima rupiah integer positif dan menolak pecahan/negatif", () => { expect(positiveRupiahSchema.safeParse(10_000).success).toBe(true); expect(positiveRupiahSchema.safeParse(-1).success).toBe(false); expect(positiveRupiahSchema.safeParse(10.5).success).toBe(false); });
  it("membatasi presisi berat sampai tiga desimal", () => { expect(decimalQuantitySchema.safeParse("103.500").success).toBe(true); expect(decimalQuantitySchema.safeParse("1.0001").success).toBe(false); });
  it("mewajibkan snapshot kuantitas sesuai basis harga", () => { expect(saleItemSnapshotSchema.safeParse({ pricingBasis: "kg", crateQuantity: "10", pricingQuantity: "103.5", unitPriceRupiah: 25000, subtotalRupiah: 2587500 }).success).toBe(false); expect(saleItemSnapshotSchema.safeParse({ pricingBasis: "kg", weightKg: "103.5", pricingQuantity: "103.5", unitPriceRupiah: 25000, subtotalRupiah: 2587500 }).success).toBe(true); });
});
