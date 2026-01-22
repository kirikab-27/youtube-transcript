import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params

    if (!videoId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_VIDEO_ID',
            message: '動画IDが指定されていません',
          },
        },
        { status: 400 }
      )
    }

    // ダミーデータ（実際の実装では YouTube API を使用）
    const languages = [
      { code: 'ja', name: '日本語', type: 'manual', isDefault: true },
      { code: 'en', name: 'English', type: 'manual', isDefault: false },
      { code: 'auto-ja', name: '自動生成 (日本語)', type: 'auto', isDefault: false },
      { code: 'auto-en', name: '自動生成 (English)', type: 'auto', isDefault: false },
      { code: 'zh-CN', name: '中文 (简体)', type: 'translated', isDefault: false },
      { code: 'ko', name: '한국어', type: 'translated', isDefault: false },
    ]

    return NextResponse.json({
      success: true,
      data: {
        languages,
        default: 'ja',
      },
    })
  } catch (error) {
    console.error('API Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '言語リストの取得に失敗しました',
        },
      },
      { status: 500 }
    )
  }
}