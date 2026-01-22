import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'YouTube文字起こし - 簡単・高速・無料の字幕取得ツール',
  description: 'YouTube動画の字幕を簡単に取得・表示。タイムスタンプ付きでコピー可能。学習ノート作成や議事録作成に最適な無料ツール。',
  keywords: 'YouTube,字幕,文字起こし,transcript,タイムスタンプ,コピー,学習,議事録',
  openGraph: {
    title: 'YouTube文字起こし',
    description: 'YouTube動画の字幕を簡単に取得・表示',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}