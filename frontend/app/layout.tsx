import type { Metadata, Viewport } from 'next';
import { Noto_Sans, Noto_Sans_Devanagari, Noto_Sans_Gujarati, Noto_Sans_Tamil } from 'next/font/google';
import { AppProvider } from '@/context/AppContext';
import { LanguageProvider } from '@/components/providers/language-provider';
import { TopBar } from '@/components/navigation/TopBar';
import { TabBar } from '@/components/navigation/TabBar';

import './globals.css';

const notoSans = Noto_Sans({
  subsets: ['latin'],
  variable: '--font-noto-sans',
  display: 'swap',
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-noto-devanagari',
  display: 'swap',
});

const notoGujarati = Noto_Sans_Gujarati({
  subsets: ['gujarati'],
  variable: '--font-noto-gujarati',
  display: 'swap',
});

const notoTamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  variable: '--font-noto-tamil',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GramSahayak (ग्राम सहायक) — Voice, Call & SMS Assistant',
  description:
    'GramSahayak: Omnichannel Multilingual Assistant for Rural Citizens in Hindi, Marathi, Tamil and English (MNIT Sphinx Domain 2.1).',
  applicationName: 'GramSahayak',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fef3c7',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hi"
      className={`${notoSans.variable} ${notoDevanagari.variable} ${notoGujarati.variable} ${notoTamil.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col overflow-x-hidden">
        <AppProvider>
          <LanguageProvider initialLanguage="hi">
            <TopBar />
            <TabBar />
            <main className="flex-1 pb-20 md:pb-8">{children}</main>
          </LanguageProvider>
        </AppProvider>
      </body>
    </html>
  );
}
