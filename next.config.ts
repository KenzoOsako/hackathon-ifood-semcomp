import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "static.ifood-static.com.br", port: "", pathname: "/image/upload/**" }],
    maximumRedirects: 0,
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
