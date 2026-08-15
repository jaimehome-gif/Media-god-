import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'StreamVibe - Movies, TV Shows & Live TV',
  description: 'Watch unlimited movies, TV shows, and live TV channels.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a1625',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents accidental Fire Stick / phone zooming
  viewportFit: 'cover', // Ensures full bleed for notch phones & TV screens
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background dark select-none">
      <head>
        {/* Enables TV D-pad / Remote directional navigation support */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('keydown', function(e) {
                // Keep focus inside TV interactive elements on Arrow key presses
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                  document.body.classList.add('tv-mode');
                }
              });
              document.addEventListener('mousemove', function() {
                document.body.classList.remove('tv-mode');
              });
            `,
          }}
        />
      </head>
      <body
        className={`${inter.className} antialiased text-foreground bg-background min-h-screen overscroll-none touch-manipulation`}
      >
        {/* TV & Mobile Safe Area Padding Wrapper */}
        <div className="w-full min-h-screen px-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] tv:px-12 tv:py-8">
          {children}
        </div>
        <Toaster position="bottom-right" theme="dark" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
