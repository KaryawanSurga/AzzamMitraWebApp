import { describe, expect, it } from "vitest";
import { deliveryReceiptSchema, deriveDeliveryStatus, manualDeliveryStatuses, validateDeliveryPlan, validateDeliveryReceipt, validateDeliveryStatusChange } from "./deliveries";

describe("status pengiriman", () => {
  it("bergerak dari sebagian ke diterima mengikuti agregat penerimaan", () => {
    expect(deriveDeliveryStatus(10000, 0, "unprocessed")).toBe("unprocessed");
    expect(deriveDeliveryStatus(10000, 0, "in_transit")).toBe("in_transit");
    expect(deriveDeliveryStatus(10000, 6000, "in_transit")).toBe("partially_delivered");
    expect(deriveDeliveryStatus(10000, 10000, "partially_delivered")).toBe("received");
  });

  it("tidak menghidupkan kembali pengiriman yang gagal atau dibatalkan", () => {
    expect(deriveDeliveryStatus(10000, 0, "cancelled")).toBe("cancelled");
    expect(deriveDeliveryStatus(10000, 5000, "failed")).toBe("failed");
    expect(deriveDeliveryStatus(10000, 10000, "cancelled")).toBe("cancelled");
  });

  it("menolak penerimaan yang melebihi rencana atau setelah status terminal", () => {
    expect(validateDeliveryReceipt(10000, 6000, 4000, "partially_delivered")).toBeNull();
    expect(validateDeliveryReceipt(10000, 6000, 5000, "partially_delivered")).toBe("Jumlah diterima melebihi rencana pengiriman (10 peti).");
    expect(validateDeliveryReceipt(10000, 0, 1, "cancelled")).toBe("Pengiriman ini sudah ditandai gagal atau dibatalkan.");
  });

  it("menjaga total rencana pengiriman tidak melebihi peti pada penjualan", () => {
    expect(validateDeliveryPlan(10000, 0, 6000)).toBeNull();
    expect(validateDeliveryPlan(10000, 6000, 4000)).toBeNull();
    expect(validateDeliveryPlan(10000, 6000, 5000)).toBe("Total rencana pengiriman melebihi jumlah peti pada penjualan (10 peti).");
    expect(validateDeliveryPlan(0, 0, 1)).toBe("Penjualan ini tidak mencatat peti, jadi tidak ada yang bisa dikirim.");
  });

  it("mengunci perubahan status yang tidak sah", () => {
    expect(validateDeliveryStatusChange("unprocessed", "in_transit")).toBeNull();
    expect(validateDeliveryStatusChange("received", "in_transit")).toBe("Pengiriman yang sudah diterima tidak dapat diubah statusnya.");
    expect(validateDeliveryStatusChange("failed", "in_transit")).toBe("Pengiriman yang gagal atau dibatalkan tidak dapat diubah lagi.");
    expect(validateDeliveryStatusChange("ready", "ready")).toBe("Status pengiriman sudah sama.");
  });

  it("hanya menerima status manual yang boleh dipilih pengguna", () => {
    expect(manualDeliveryStatuses).toEqual(["preparing", "ready", "in_transit", "failed", "cancelled"]);
  });

  it("memvalidasi kontrak penerimaan bertahap", () => {
    const base = { deliveryId: "33333333-3333-4333-8333-333333333333", receivedAt: "2026-09-16", idempotencyKey: "44444444-4444-4444-8444-444444444444" } as const;
    expect(deliveryReceiptSchema.safeParse({ ...base, crateQuantity: "6" }).success).toBe(true);
    expect(deliveryReceiptSchema.safeParse({ ...base, crateQuantity: "0" }).success).toBe(false);
    expect(deliveryReceiptSchema.safeParse({ ...base, crateQuantity: "1.0001" }).success).toBe(false);
  });
});
