import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const requestSchema = z.object({
  url: z.string().url(),
  language: z.string().optional(),
  preferredType: z.enum(['manual', 'auto', 'any']).optional().default('any'),
})

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }
  return null
}

// Innertube APIを使用した字幕取得の実装
async function fetchYouTubeTranscript(videoId: string, languageCode?: string) {
  try {
    // YouTubeiのAPIエンドポイントを使用
    const apiUrl = 'https://www.youtube.com/youtubei/v1/player'

    // リクエストボディ
    const requestBody = {
      context: {
        client: {
          hl: languageCode || 'ja',
          gl: 'JP',
          clientName: 'WEB',
          clientVersion: '2.20240101.00.00'
        }
      },
      videoId: videoId
    }

    // APIリクエスト
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`YouTube API responded with status: ${response.status}`)
    }

    const data = await response.json()

    // 字幕トラックを取得
    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []

    if (captionTracks.length === 0) {
      // 字幕が取得できない場合は、代替のプロキシサービスを使用
      return fetchTranscriptViaProxy(videoId, languageCode)
    }

    // 言語を選択
    let selectedTrack = captionTracks[0]
    if (languageCode) {
      const matchingTrack = captionTracks.find((track: any) =>
        track.languageCode === languageCode ||
        track.languageCode.startsWith(languageCode)
      )
      if (matchingTrack) {
        selectedTrack = matchingTrack
      }
    }

    // 字幕URLから字幕データを取得
    const captionUrl = selectedTrack.baseUrl
    const captionResponse = await fetch(captionUrl)
    const xmlText = await captionResponse.text()

    // XMLパース
    const segments = parseTranscriptXML(xmlText)

    if (segments.length === 0) {
      throw new Error('字幕データの解析に失敗しました')
    }

    // タイトルと長さの取得
    const title = data?.videoDetails?.title || `Video ${videoId}`
    const duration = parseInt(data?.videoDetails?.lengthSeconds || '0')

    return {
      id: `transcript_${videoId}_${Date.now()}`,
      videoId,
      title,
      duration,
      language: selectedTrack.languageCode || languageCode || 'auto',
      segments,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  } catch (error) {
    console.error('Failed to fetch transcript via Innertube:', error)
    // フォールバックとしてプロキシサービスを使用
    return fetchTranscriptViaProxy(videoId, languageCode)
  }
}

// XMLから字幕セグメントをパース
function parseTranscriptXML(xmlText: string) {
  const segments = []
  const textRegex = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]+)<\/text>/g
  let match
  let index = 1

  while ((match = textRegex.exec(xmlText)) !== null) {
    const start = parseFloat(match[1])
    const duration = parseFloat(match[2])
    const text = match[3]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim()

    segments.push({
      id: String(index++),
      start: start,
      end: start + duration,
      text: text
    })
  }

  return segments
}

// プロキシサービス経由で字幕を取得（フォールバック）
async function fetchTranscriptViaProxy(videoId: string, languageCode?: string) {
  try {
    // 公開のプロキシサービス（例：youtube-transcript.io）を使用
    const proxyUrl = `https://youtube-transcript-api.fly.dev/api/transcript/${videoId}`

    const response = await fetch(proxyUrl, {
      headers: {
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      throw new Error(`Proxy service responded with status: ${response.status}`)
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      throw new Error('字幕データが取得できませんでした')
    }

    // データ形式を変換
    const segments = data.map((item: any, index: number) => ({
      id: String(index + 1),
      start: item.start || 0,
      end: (item.start || 0) + (item.duration || 0),
      text: item.text || ''
    }))

    const lastSegment = segments[segments.length - 1]
    const duration = lastSegment ? lastSegment.end : 0

    return {
      id: `transcript_${videoId}_${Date.now()}`,
      videoId,
      title: `Video ${videoId}`,
      duration,
      language: languageCode || 'auto',
      segments,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  } catch (error: any) {
    console.error('Failed to fetch transcript via proxy:', error)

    // 最終的なフォールバック：サンプルデータを返す（開発用）
    if (process.env.NODE_ENV === 'development') {
      return generateSampleTranscript(videoId, languageCode)
    }

    throw new Error('字幕の取得に失敗しました。この動画には字幕が存在しないか、取得できない可能性があります。')
  }
}

// 開発用のサンプルデータ生成
function generateSampleTranscript(videoId: string, languageCode?: string) {
  const isJapanese = !languageCode || languageCode === 'ja'

  const segments = isJapanese ? [
    {
      id: '1',
      start: 0,
      end: 3,
      text: '【開発モード】これはサンプルの字幕データです。',
    },
    {
      id: '2',
      start: 3,
      end: 7,
      text: '実際のYouTube動画から字幕を取得するには、',
    },
    {
      id: '3',
      start: 7,
      end: 10,
      text: '有効なAPIキーまたはプロキシサービスが必要です。',
    },
    {
      id: '4',
      start: 10,
      end: 14,
      text: '字幕が有効になっている動画のURLを入力してください。',
    },
    {
      id: '5',
      start: 14,
      end: 17,
      text: 'タイムスタンプ付きでコピーすることも可能です。',
    },
  ] : [
    {
      id: '1',
      start: 0,
      end: 3,
      text: '[DEV MODE] This is sample subtitle data.',
    },
    {
      id: '2',
      start: 3,
      end: 7,
      text: 'To fetch real YouTube subtitles,',
    },
    {
      id: '3',
      start: 7,
      end: 10,
      text: 'a valid API key or proxy service is required.',
    },
    {
      id: '4',
      start: 10,
      end: 14,
      text: 'Please enter a URL for a video with subtitles enabled.',
    },
    {
      id: '5',
      start: 14,
      end: 17,
      text: 'You can also copy with timestamps.',
    },
  ]

  return {
    id: `transcript_${videoId}_${Date.now()}`,
    videoId,
    title: `[開発モード] サンプル動画 ${videoId}`,
    duration: 17,
    language: languageCode || 'ja',
    segments,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = requestSchema.parse(body)

    const videoId = extractVideoId(validatedData.url)
    if (!videoId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_URL',
            message: '有効なYouTube URLを入力してください',
            suggestion: 'URLの形式: https://www.youtube.com/watch?v=VIDEO_ID',
          },
        },
        { status: 400 }
      )
    }

    const transcript = await fetchYouTubeTranscript(videoId, validatedData.language)

    return NextResponse.json({
      success: true,
      data: transcript,
    })
  } catch (error) {
    console.error('API Error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'リクエストパラメータが不正です',
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '内部エラーが発生しました',
          suggestion: '時間を置いて再度お試しください',
        },
      },
      { status: 500 }
    )
  }
}