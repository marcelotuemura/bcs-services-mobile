/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: [
        'bestcoatingssolution.com',
        'www.bestcoatingssolution.com',
        'bcs-services-mobile.vercel.app'
      ]
    }
  }
};

export default nextConfig;
