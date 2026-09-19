import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PwaInstall } from "./pwa-install";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

describe("PwaInstall", () => {
  it("menampilkan tombol install setelah browser menawarkannya dan memanggil prompt", async () => {
    render(<PwaInstall />);
    expect(screen.queryByRole("button", { name: "Install aplikasi di HP" })).not.toBeInTheDocument();
    const event = new Event("beforeinstallprompt") as InstallEvent;
    event.prompt = vi.fn().mockResolvedValue(undefined);
    fireEvent(window, event);
    const button = await screen.findByRole("button", { name: "Install aplikasi di HP" });
    fireEvent.click(button);
    expect(event.prompt).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Install aplikasi di HP" })).not.toBeInTheDocument());
  });

  it("menampilkan petunjuk Add to Home Screen di iPhone", async () => {
    const original = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", configurable: true });
    render(<PwaInstall />);
    expect(await screen.findByText(/Tambahkan ke Layar Utama/)).toBeInTheDocument();
    Object.defineProperty(navigator, "userAgent", { value: original, configurable: true });
  });
});
