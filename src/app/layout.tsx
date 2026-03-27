import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { FloatingGlows } from '@/components/ui/FloatingGlows';
import { AppHeader } from '@/components/layout/AppHeader';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'DS Tracker — Real Estate UI',
  description:
    'Suivi des changements du Design System Real Estate UI pour les équipes de développement.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full flex flex-col font-sans bg-slate-950 overflow-hidden" suppressHydrationWarning>
        <FloatingGlows />
        <div className="relative z-[1] flex flex-col h-full">
          <AppHeader />
          <div className="flex-1 min-h-0 overflow-y-auto">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
