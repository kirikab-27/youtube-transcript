'use client'

import { useState } from 'react'
import { Header } from '@/components/layouts/Header'
import { URLInput } from '@/components/features/URLInput'
import { TranscriptViewer } from '@/components/features/TranscriptViewer'
import { TranscriptData } from '@/types/transcript.types'

export default function Home() {
  const [transcript, setTranscript] = useState<TranscriptData | null>(null)

  const handleTranscriptGenerated = (data: TranscriptData) => {
    setTranscript(data)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <section className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              YouTube文字起こし
            </h1>
            <p className="text-muted-foreground text-lg">
              YouTube動画のURLを入力すると、字幕を取得して表示します
            </p>
          </section>

          <URLInput onTranscriptGenerated={handleTranscriptGenerated} />

          {transcript && (
            <TranscriptViewer transcript={transcript} />
          )}

          {!transcript && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">動画のURLを入力してください</p>
              <p className="text-sm mt-2">
                字幕（自動生成含む）がある動画から文字起こしを取得できます
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}