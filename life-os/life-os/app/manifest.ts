import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeOS — Personal Life Dashboard",
    short_name: "LifeOS",
    description: "Jadwal, tugas, keuangan, goals & Personal AI dalam satu aplikasi.",
    start_url: "/",
    display: "standalone",
    background_color: "#080D18",
    theme_color: "#080D18",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
