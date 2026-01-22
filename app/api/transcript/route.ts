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
  // 複数のアプローチを試す
  const approaches = [
    () => fetchViaCustomAPI(videoId, languageCode),
    () => fetchTranscriptViaProxy(videoId, languageCode),
    () => fetchViaDirectScraping(videoId, languageCode)
  ]

  for (const approach of approaches) {
    try {
      const result = await approach()
      if (result && result.segments && result.segments.length > 0) {
        return result
      }
    } catch (error) {
      console.log('Approach failed:', error)
      continue
    }
  }

  // すべてのアプローチが失敗した場合
  if (process.env.NODE_ENV === 'development') {
    return generateSampleTranscript(videoId, languageCode)
  }

  throw new Error('字幕の取得に失敗しました。この動画には字幕が存在しないか、取得できない可能性があります。')
}

// カスタムAPIを使用した字幕取得
async function fetchViaCustomAPI(videoId: string, languageCode?: string) {
  try {
    // ytdl-core風のAPIを使用
    const apiUrl = `https://pipedapi.kavin.rocks/streams/${videoId}`

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()

    // 字幕データを確認
    const subtitles = data.subtitles || []
    if (subtitles.length === 0) {
      throw new Error('No subtitles available')
    }

    // 言語を選択
    let selectedSubtitle = subtitles[0]
    if (languageCode) {
      const matching = subtitles.find((sub: any) =>
        sub.code === languageCode || sub.code?.startsWith(languageCode)
      )
      if (matching) {
        selectedSubtitle = matching
      }
    }

    // 字幕URLから字幕データを取得
    const subtitleResponse = await fetch(selectedSubtitle.url)
    const subtitleText = await subtitleResponse.text()

    // VTT形式の字幕をパース
    const segments = parseVTT(subtitleText)

    if (segments.length === 0) {
      throw new Error('Failed to parse subtitles')
    }

    return {
      id: `transcript_${videoId}_${Date.now()}`,
      videoId,
      title: data.title || `Video ${videoId}`,
      duration: data.duration || 0,
      language: selectedSubtitle.code || languageCode || 'auto',
      segments,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  } catch (error) {
    console.error('Custom API failed:', error)
    throw error
  }
}

// VTT形式の字幕をパース
function parseVTT(vttText: string) {
  const segments = []
  const lines = vttText.split('\n')
  let index = 1
  let i = 0

  // WEBVTT ヘッダーをスキップ
  while (i < lines.length && !lines[i].includes('-->')) {
    i++
  }

  while (i < lines.length) {
    const line = lines[i]

    if (line.includes('-->')) {
      const [startTime, endTime] = line.split('-->').map(t => t.trim())
      const start = parseVTTTime(startTime)
      const end = parseVTTTime(endTime)

      i++
      let text = ''
      while (i < lines.length && lines[i].trim() !== '') {
        text += lines[i].trim() + ' '
        i++
      }

      if (text.trim()) {
        segments.push({
          id: String(index++),
          start,
          end,
          text: text.trim()
        })
      }
    }
    i++
  }

  return segments
}

// VTT時間形式をパース（00:00:00.000 または 00:00.000）
function parseVTTTime(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds)
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts
    return parseInt(minutes) * 60 + parseFloat(seconds)
  }
  return 0
}

// 直接スクレイピングによる字幕取得
async function fetchViaDirectScraping(videoId: string, languageCode?: string) {
  try {
    const videoInfoUrl = `https://www.youtube.com/watch?v=${videoId}`
    const pageResponse = await fetch(videoInfoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': languageCode ? `${languageCode},en-US;q=0.9,en;q=0.8` : 'ja,en-US;q=0.9,en;q=0.8',
      }
    })

    const pageContent = await pageResponse.text()

    // 改良されたcaptionTracks抽出
    const captionRegex = /"captionTracks":\s*(\[.*?\])/s
    const captionMatch = pageContent.match(captionRegex)

    if (!captionMatch) {
      // 代替パターンを試す
      const altRegex = /"playerCaptionsTracklistRenderer":\s*\{.*?"captionTracks":\s*(\[.*?\])/s
      const altMatch = pageContent.match(altRegex)
      if (!altMatch) {
        throw new Error('Caption tracks not found')
      }
      captionMatch[1] = altMatch[1]
    }

    const captionTracks = JSON.parse(captionMatch[1])

    if (captionTracks.length === 0) {
      throw new Error('No captions available')
    }

    // 言語を選択
    let selectedTrack = captionTracks[0]
    if (languageCode) {
      const matchingTrack = captionTracks.find((track: any) =>
        track.languageCode === languageCode ||
        track.languageCode?.startsWith(languageCode)
      )
      if (matchingTrack) {
        selectedTrack = matchingTrack
      }
    }

    // 字幕URLから字幕データを取得
    const captionUrl = selectedTrack.baseUrl
    if (!captionUrl) {
      throw new Error('Caption URL not found')
    }

    const captionResponse = await fetch(captionUrl)
    const xmlText = await captionResponse.text()

    // XMLパース
    const segments = parseTranscriptXML(xmlText)

    if (segments.length === 0) {
      throw new Error('Failed to parse caption data')
    }

    // タイトルを取得
    const titleMatch = pageContent.match(/<meta name="title" content="([^"]+)">/) ||
                       pageContent.match(/<title>([^<]+)<\/title>/)
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : `Video ${videoId}`

    const lastSegment = segments[segments.length - 1]
    const duration = lastSegment ? Math.ceil(lastSegment.end) : 0

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
    console.error('Direct scraping failed:', error)
    throw error
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

// プロキシサービス経由で字幕を取得
async function fetchTranscriptViaProxy(videoId: string, languageCode?: string) {
  // 複数のプロキシサービスを試す
  const proxyServices = [
    {
      name: 'youtube-transcript-api',
      url: `https://youtube-transcript-api-two.vercel.app/api/transcript?videoId=${videoId}${languageCode ? `&lang=${languageCode}` : ''}`,
      method: 'GET',
    },
    {
      name: 'yt-dlp-web',
      url: `https://yt-dlp-api.onrender.com/transcript/${videoId}`,
      method: 'GET',
    },
  ]

  for (const service of proxyServices) {
    try {
      console.log(`Trying ${service.name} service...`)

      const response = await fetch(service.url, {
        method: service.method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.log(`${service.name} responded with status: ${response.status}`)
        continue
      }

      const data = await response.json()

      // データ形式を正規化
      let segments = []
      let title = `Video ${videoId}`

      // サービスによってレスポンス形式が異なるため、適応的に処理
      if (Array.isArray(data)) {
        segments = data.map((item: any, index: number) => ({
          id: String(index + 1),
          start: parseFloat(item.start || item.offset || 0),
          end: parseFloat(item.end || ((item.start || item.offset || 0) + (item.duration || item.dur || 0))),
          text: item.text || item.content || ''
        }))
      } else if (data.transcript && Array.isArray(data.transcript)) {
        segments = data.transcript.map((item: any, index: number) => ({
          id: String(index + 1),
          start: parseFloat(item.start || item.offset || 0),
          end: parseFloat(item.end || ((item.start || item.offset || 0) + (item.duration || item.dur || 0))),
          text: item.text || item.content || ''
        }))
        title = data.title || title
      } else if (data.segments && Array.isArray(data.segments)) {
        segments = data.segments.map((item: any, index: number) => ({
          id: String(index + 1),
          start: parseFloat(item.start || 0),
          end: parseFloat(item.end || (item.start + (item.duration || 0))),
          text: item.text || ''
        }))
        title = data.title || title
      }

      if (segments.length === 0) {
        console.log(`${service.name} returned empty segments`)
        continue
      }

      const lastSegment = segments[segments.length - 1]
      const duration = lastSegment ? lastSegment.end : 0

      return {
        id: `transcript_${videoId}_${Date.now()}`,
        videoId,
        title,
        duration,
        language: languageCode || 'auto',
        segments,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    } catch (error: any) {
      console.error(`Failed with ${service.name}:`, error.message)
      continue
    }
  }

  // すべてのプロキシサービスが失敗した場合
  console.error('All proxy services failed')

  // 開発環境ではサンプルデータを返す
  if (process.env.NODE_ENV === 'development') {
    return generateSampleTranscript(videoId, languageCode)
  }

  throw new Error('字幕の取得に失敗しました。この動画には字幕が存在しないか、取得できない可能性があります。')
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
        'Cache-Control': 'public, max-age=3600', // 1時間キャッシュ
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

    // より詳細なエラーメッセージ
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
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}