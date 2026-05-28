import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { RootProvider } from '@/components/RootProvider';
import { GSAPProvider } from '@/components/GSAPProvider';
import { FloatingPlayer } from '@/components/FloatingPlayer';

export const metadata: Metadata = {
  title: 'MoodyO — Feel The Music',
  description: 'An elegant, AI-powered, mood-based music platform. Every emotion has a sound.',
  keywords: ['music', 'mood', 'AI', 'playlist', 'emotion'],
  openGraph: {
    title: 'MoodyO — Feel The Music',
    description: 'A serene cream canvas. Pure music. Every mood introduces a warm aura.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        {/* DM Sans — primary UI font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap"
          rel="stylesheet"
        />
        {/* Clash Display — hero/display font */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&display=swap"
          rel="stylesheet"
        />
        {/* Material Symbols */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <GSAPProvider>
          <RootProvider>
            {children}
            <FloatingPlayer />
          </RootProvider>
        </GSAPProvider>
        <Toaster />
      </body>
    </html>
  );
}
