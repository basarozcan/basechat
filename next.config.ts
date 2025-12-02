import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set to false because strict mode breaks components that call APIs when the component is rendered (like in Conversation)
  reactStrictMode: false,
  // Only use Redis cache handler if REDIS_URL is present
  ...(process.env.USE_REDIS && {
    cacheHandler: require.resolve("./cache-handler.cjs"),
    cacheMaxMemorySize: 0, // disable default in-memory caching
  }),
  output: "standalone",
  experimental: {
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOWALL", // or use 'ALLOW-FROM https://ezcam.com'
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://ezcam.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
