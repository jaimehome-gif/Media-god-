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
  const previewHost = '3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX
  nextConfig.allowedDevOrigins = [previewHost]
  // Server Actions validate the browser's origin hostname against x-forwarded-host.
  // The preview proxy uses a distinct internal host, so allow the public preview
  // hostname explicitly. Next.js expects hostnames here, not complete URLs.
  nextConfig.experimental = {
    ...(nextConfig.experimental || {}),
    serverActions: {
      allowedOrigins: [previewHost],
    },
  }
}

export default nextConfig
