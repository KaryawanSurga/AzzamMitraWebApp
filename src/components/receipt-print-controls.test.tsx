import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReceiptPrintControls } from "./receipt-print-controls";

describe("ReceiptPrintControls", () => {
  it("menyediakan pilihan A4, thermal, dan memanggil dialog cetak browser", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<ReceiptPrintControls saleId="11111111-1111-4111-8111-111111111111" paper="a4"/>);

    expect(screen.getByRole("link", { name: "A4" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Thermal 80 mm" })).toHaveAttribute("href", "/penjualan/11111111-1111-4111-8111-111111111111/struk?paper=thermal");
    fireEvent.click(screen.getByRole("button", { name: "Cetak / simpan PDF" }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
});
