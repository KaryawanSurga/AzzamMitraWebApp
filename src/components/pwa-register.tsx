"use client";
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => { /* installability gagal diam-diam; aplikasi tetap berjalan online */ });
  }, []);
  return null;
}
