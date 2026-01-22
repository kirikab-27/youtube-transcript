"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranscript } from '@/hooks/useTranscript'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Youtube } from 'lucide-react'

interface URLInputProps {
  onTranscriptGenerated?: (data: any) => void
}

const SUPPORTED_LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'zh', label: '中文' },
  { value: 'ko', label: '한국어' },
]

export function URLInput({ onTranscriptGenerated }: URLInputProps) {
  const [url, setUrl] = useState('')
  const [language, setLanguage] = useState('auto')
  const { generateTranscript, isLoading, isError, isSuccess, data, error } = useTranscript()
  const { toast } = useToast()

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return null
  }

  const validateYouTubeURL = (url: string): boolean => {
    return extractVideoId(url) !== null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) {
      toast({
        title: 'エラー',
        description: 'YouTube URLを入力してください',
        variant: 'destructive',
      })
      return
    }

    if (!validateYouTubeURL(url)) {
      toast({
        title: 'エラー',
        description: '有効なYouTube URLを入力してください',
        variant: 'destructive',
      })
      return
    }

    try {
      generateTranscript({
        url: url.trim(),
        language: language === 'auto' ? undefined : language,
      })
    } catch (error) {
      toast({
        title: 'エラー',
        description: '文字起こしの生成に失敗しました',
        variant: 'destructive',
      })
    }
  }

  // Handle successful transcript generation
  React.useEffect(() => {
    if (isSuccess && data) {
      toast({
        title: '成功',
        description: '文字起こしが生成されました',
      })
      onTranscriptGenerated?.(data)
      setUrl('') // Clear the input after successful generation
    }
  }, [isSuccess, data, onTranscriptGenerated, toast])

  // Handle errors
  React.useEffect(() => {
    if (isError && error) {
      toast({
        title: 'エラー',
        description: error,
        variant: 'destructive',
      })
    }
  }, [isError, error, toast])

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="space-y-6">
        <div className="text-center">
          <Youtube className="mx-auto h-12 w-12 text-red-600 mb-4" />
          <h1 className="text-3xl font-bold tracking-tight">YouTube 文字起こし</h1>
          <p className="text-muted-foreground mt-2">
            YouTube動画のURLを入力して、自動で文字起こしを生成します
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">YouTube URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">言語設定</Label>
            <Select value={language} onValueChange={setLanguage} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="言語を選択" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                文字起こし生成中...
              </>
            ) : (
              '文字起こしを生成'
            )}
          </Button>
        </form>

        {/* Progress indicator */}
        {isLoading && (
          <div className="space-y-2">
            <div className="w-full bg-secondary rounded-full h-2">
              <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              動画を解析中です...しばらくお待ちください
            </p>
          </div>
        )}
      </div>
    </div>
  )
}