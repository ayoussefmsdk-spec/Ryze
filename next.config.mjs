/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow the app to run behind Railway's proxy.
  poweredByHeader: false,
  experimental: {
    // Enables instrumentation.js (starts the in-process check scheduler).
    instrumentationHook: true,
  },
};

export default nextConfig;
