import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL?.startsWith("https://")
    ? process.env.APP_URL
    : "https://bookflow-green.vercel.app";
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/terms`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/safety`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
