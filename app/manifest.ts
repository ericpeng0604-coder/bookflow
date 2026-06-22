import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "虎科書流",
    short_name: "虎科書流",
    description: "虎尾科大校園課本與二手好物交流平台",
    start_url: "/",
    display: "standalone",
    background_color: "#fffef9",
    theme_color: "#1d6a57",
    lang: "zh-Hant",
    categories: ["education", "shopping", "social"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
