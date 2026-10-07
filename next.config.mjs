/** @type {import('next').NextConfig} */

// Allow the Base44 preview origin to load dev assets / HMR.
const allowedDevOrigins = []
if (
  process.env.BASE44_PREVIEW_MODE === '1' &&
  process.env.BASE44_PUBLIC_HOST_SUFFIX
) {
  allowedDevOrigins.push('https://3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX)
}

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
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
}

export default nextConfig
