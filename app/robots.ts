import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL?.startsWith("https://")
    ? process.env.APP_URL
    : "https://bookflow-green.vercel.app";
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/privacy", "/terms", "/safety"],
      disallow: ["/api/", "/?view=dashboard", "/?view=admin"],
    }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
