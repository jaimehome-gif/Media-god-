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
  const previewOrigin = 'https://3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX
  nextConfig.allowedDevOrigins = [
    '3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX,
    previewOrigin,
  ]
  // Server Actions validate the browser's origin header against x-forwarded-host.
  // The preview proxy forwards with a different internal host, so allow the
  // public preview origin explicitly for Server Actions requests.
  nextConfig.experimental = {
    ...(nextConfig.experimental || {}),
    serverActions: {
      allowedOrigins: [previewOrigin],
    },
  }
}

export default nextConfig
