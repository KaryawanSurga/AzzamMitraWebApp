"use client";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaInstall({ className = "button-secondary" }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent)));
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isIos) return <p className="pwa-hint">Di iPhone: buka menu Bagikan, lalu pilih “Tambahkan ke Layar Utama”.</p>;
  if (!promptEvent) return null;

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await promptEvent.prompt();
        setPromptEvent(null);
      }}
    >
      Install aplikasi di HP
    </button>
  );
}
