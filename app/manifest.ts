import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Entrenadores Urdaneta",
    short_name: "Urdaneta",
    description: "Portal de entrenadores del Club Deportivo Urdaneta",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "any",
    background_color: "#07170b",
    theme_color: "#0d2414",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
