import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const requestSchema = z.object({
  url: z.string().url(),
  language: z.string().optional(),
  preferredType: z.enum(['manual', 'auto', 'any']).optional().default('any'),
})

// YouTube Innertube API Key (公開キー)
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'

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

// Innertube Player API を使用した字幕取得
async function fetchYouTubeTranscript(videoId: string, languageCode?: string) {
  console.log(`[Transcript] Fetching transcript for videoId: ${videoId}, language: ${languageCode || 'auto'}`)

  // 1. Player API から字幕トラック情報を取得
  const playerResponse = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            hl: languageCode || 'ja',
            gl: 'JP',
            clientName: 'WEB',
            clientVersion: '2.20231219.04.00',
          },
        },
        videoId: videoId,
      }),
    }
  )

  console.log(`[Transcript] Player API response status: ${playerResponse.status}`)

  if (!playerResponse.ok) {
    const errorText = await playerResponse.text()
    console.error(`[Transcript] Player API error: ${playerResponse.status}`, errorText.substring(0, 500))
    throw new Error(`Player API error: ${playerResponse.status}`)
  }

  const playerData = await playerResponse.json()
  console.log(`[Transcript] Video title: ${playerData.videoDetails?.title || 'N/A'}`)

  // 動画タイトルを取得
  const title = playerData.videoDetails?.title || `YouTube Video ${videoId}`
  const videoDuration = parseInt(playerData.videoDetails?.lengthSeconds || '0', 10)

  // 字幕トラックを取得
  const captions = playerData.captions?.playerCaptionsTracklistRenderer
  const tracks = captions?.captionTracks || []

  console.log(`[Transcript] Found ${tracks.length} caption tracks`)

  if (tracks.length === 0) {
    throw new Error('この動画には字幕が存在しません')
  }

  // 言語に合った字幕を選択（手動字幕優先）
  let selectedTrack = tracks[0]
  if (languageCode) {
    // まず手動字幕を探す
    const manualTrack = tracks.find(
      (t: any) => t.languageCode === languageCode && t.kind !== 'asr'
    )
    // なければ自動生成字幕
    const autoTrack = tracks.find(
      (t: any) => t.languageCode === languageCode
    )
    selectedTrack = manualTrack || autoTrack || selectedTrack
  } else {
    // 日本語優先、なければ英語、それもなければ最初のトラック
    const jaTrack = tracks.find((t: any) => t.languageCode === 'ja' && t.kind !== 'asr')
    const enTrack = tracks.find((t: any) => t.languageCode === 'en' && t.kind !== 'asr')
    selectedTrack = jaTrack || enTrack || tracks[0]
  }

  // 2. 字幕データを取得 (JSON3形式)
  const captionUrl = selectedTrack.baseUrl + '&fmt=json3'
  console.log(`[Transcript] Fetching caption from: ${captionUrl.substring(0, 100)}...`)

  const captionResponse = await fetch(captionUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })

  console.log(`[Transcript] Caption response status: ${captionResponse.status}`)

  if (!captionResponse.ok) {
    const errorText = await captionResponse.text()
    console.error(`[Transcript] Caption fetch error: ${captionResponse.status}`, errorText.substring(0, 500))
    throw new Error(`Caption fetch error: ${captionResponse.status}`)
  }

  const captionData = await captionResponse.json()

  // 3. セグメントを整形
  const events = captionData.events || []
  const segments = events
    .filter((event: any) => event.segs && event.segs.length > 0)
    .map((event: any, index: number) => {
      const text = event.segs
        .map((seg: any) => seg.utf8 || '')
        .join('')
        .replace(/\n/g, ' ')
        .trim()

      return {
        id: String(index + 1),
        start: (event.tStartMs || 0) / 1000,
        end: ((event.tStartMs || 0) + (event.dDurationMs || 0)) / 1000,
        text: text,
      }
    })
    .filter((seg: any) => seg.text.length > 0)

  if (segments.length === 0) {
    throw new Error('字幕データのパースに失敗しました')
  }

  const lastSegment = segments[segments.length - 1]
  const duration = lastSegment ? Math.ceil(lastSegment.end) : videoDuration

  return {
    id: `transcript_${videoId}_${Date.now()}`,
    videoId,
    title,
    duration,
    language: selectedTrack.languageCode || languageCode || 'ja',
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
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      )
    }

    // タイムアウト付きで実行
    const timeoutMs = parseInt(process.env.YOUTUBE_API_TIMEOUT || '30000')
    const transcriptPromise = fetchYouTubeTranscript(videoId, validatedData.language)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('リクエストがタイムアウトしました')), timeoutMs)
    )

    const transcript = await Promise.race([transcriptPromise, timeoutPromise])

    return NextResponse.json({
      success: true,
      data: transcript,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600',
      }
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
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      )
    }

    let errorMessage = '内部エラーが発生しました'
    let errorCode = 'INTERNAL_ERROR'

    if (error instanceof Error) {
      if (error.message.includes('タイムアウト')) {
        errorCode = 'TIMEOUT_ERROR'
        errorMessage = 'リクエストがタイムアウトしました。動画が長すぎる可能性があります。'
      } else if (error.message.includes('字幕が存在しない')) {
        errorCode = 'NO_CAPTIONS'
        errorMessage = 'この動画には字幕が存在しないか、取得できません。'
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          suggestion: '時間を置いて再度お試しいただくか、別の動画をお試しください。',
        },
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    )
  }
}

// OPTIONSメソッドのハンドラー（CORS preflight）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
