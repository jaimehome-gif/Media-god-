/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
  },
}

if (process.env.BASE44_PREVIEW_MODE === '1' && process.env.BASE44_PUBLIC_HOST_SUFFIX) {
  nextConfig.allowedDevOrigins = ['https://3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX]
}

export default nextConfig
