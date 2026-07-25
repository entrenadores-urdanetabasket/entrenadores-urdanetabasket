import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Entrenadores Urdaneta",
    short_name: "Urdaneta",
    description: "Portal de entrenadores del Club Deportivo Urdaneta",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0c10",
    theme_color: "#0a0c10",
    icons: [
      {
        src: "/logo.png",
        sizes: "432x578",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
