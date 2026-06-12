import type { NextConfig } from "next";

function supabaseStorageHostnames() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [] as string[];
  try {
    return [new URL(url).hostname];
  } catch {
    return [] as string[];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...supabaseStorageHostnames().map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/storage/v1/object/public/**",
      })),
    ],
  },
};

export default nextConfig;
