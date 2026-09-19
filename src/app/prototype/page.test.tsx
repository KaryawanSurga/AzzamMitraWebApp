import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrototypePage from "./page";

describe("prototype page", () => {
  it("menampilkan ringkasan, grafik, dan daftar invoice contoh", () => {
    render(<PrototypePage />);
    expect(screen.getByText("Halo, Owner Azzam!")).toBeInTheDocument();
    expect(screen.getByText("Penjualan bersih")).toBeInTheDocument();
    expect(screen.getByText("Komposisi penjualan")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-0184")).toBeInTheDocument();
    expect(screen.getByText(/Data contoh, tidak terhubung database/)).toBeInTheDocument();
  });
});
