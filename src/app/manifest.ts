import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JNews — AI News Digest",
    short_name: "JNews",
    description: "Briefings de inteligência e digest personalizado de notícias por IA.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0d",
    theme_color: "#0b0b0d",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["news", "business", "productivity"],
    icons: [
      {
        src: "/icons/logo.jpeg",
        sizes: "any",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/icons/logo.jpeg",
        sizes: "any",
        type: "image/jpeg",
        purpose: "maskable",
      },
    ],
  };
}
