import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Azzam Mitra — Operasional Distributor Telur",
    short_name: "Azzam Mitra",
    description: "Pencatatan penjualan, pembayaran, pengiriman, peti, dan laporan usaha Azzam Mitra.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "id",
    background_color: "#F6F4EE",
    theme_color: "#24462C",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
