"use client"

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TranscriptData, TranscriptSegment } from '@/types/transcript.types'
import { Search, Download, Copy, Clock, Play } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface TranscriptViewerProps {
  transcript: TranscriptData
  onSegmentClick?: (segment: TranscriptSegment) => void
}

type SortOption = 'time' | 'text'
type FilterOption = 'all' | 'confidence'

export function TranscriptViewer({ transcript, onSegmentClick }: TranscriptViewerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('time')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.8)
  const { toast } = useToast()

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const filteredAndSortedSegments = useMemo(() => {
    let segments = [...transcript.segments]

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      segments = segments.filter(segment =>
        segment.text.toLowerCase().includes(term)
      )
    }

    // Apply confidence filter
    if (filterBy === 'confidence') {
      segments = segments.filter(segment =>
        !segment.confidence || segment.confidence >= confidenceThreshold
      )
    }

    // Apply sorting
    segments.sort((a, b) => {
      if (sortBy === 'time') {
        return a.start - b.start
      } else {
        return a.text.localeCompare(b.text)
      }
    })

    return segments
  }, [transcript.segments, searchTerm, sortBy, filterBy, confidenceThreshold])

  const handleCopyAll = async () => {
    const text = filteredAndSortedSegments
      .map(segment => segment.text)
      .join('\n')

    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: '成功',
        description: 'テキストをクリップボードにコピーしました',
      })
    } catch (error) {
      toast({
        title: 'エラー',
        description: 'コピーに失敗しました',
        variant: 'destructive',
      })
    }
  }

  const handleCopySegment = async (segment: TranscriptSegment) => {
    try {
      await navigator.clipboard.writeText(segment.text)
      toast({
        title: '成功',
        description: 'テキストをクリップボードにコピーしました',
      })
    } catch (error) {
      toast({
        title: 'エラー',
        description: 'コピーに失敗しました',
        variant: 'destructive',
      })
    }
  }

  const handleDownload = () => {
    const text = filteredAndSortedSegments
      .map(segment => `[${formatTime(segment.start)} - ${formatTime(segment.end)}]\n${segment.text}`)
      .join('\n\n')

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${transcript.title}_transcript.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: '成功',
      description: 'ファイルをダウンロードしました',
    })
  }

  const highlightSearchTerm = (text: string, searchTerm: string): React.ReactNode => {
    if (!searchTerm.trim()) return text

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{transcript.title}</h2>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Clock className="h-4 w-4" />
              {formatTime(transcript.duration)} | {transcript.segments.length} セグメント
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCopyAll} variant="outline" size="sm">
              <Copy className="h-4 w-4 mr-2" />
              全てコピー
            </Button>
            <Button onClick={handleDownload} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              ダウンロード
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="search">検索</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="テキストを検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="sort">並び順</Label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="time">時間順</SelectItem>
                <SelectItem value="text">テキスト順</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="filter">フィルター</Label>
            <Select value={filterBy} onValueChange={(value) => setFilterBy(value as FilterOption)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="confidence">高信頼度のみ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results info */}
        <div className="text-sm text-muted-foreground">
          {filteredAndSortedSegments.length} / {transcript.segments.length} セグメントを表示
          {searchTerm && (
            <span className="ml-2">
              「{searchTerm}」の検索結果
            </span>
          )}
        </div>
      </div>

      {/* Transcript segments */}
      <div className="space-y-2">
        {filteredAndSortedSegments.length === 0 ? (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? '検索条件に一致するセグメントが見つかりません' : 'セグメントがありません'}
            </p>
          </div>
        ) : (
          filteredAndSortedSegments.map((segment) => (
            <div
              key={segment.id}
              className="group border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => onSegmentClick?.(segment)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Play className="h-3 w-3" />
                    <span>{formatTime(segment.start)} - {formatTime(segment.end)}</span>
                    {segment.confidence && (
                      <span className="ml-auto text-xs">
                        信頼度: {Math.round(segment.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-foreground leading-relaxed">
                    {highlightSearchTerm(segment.text, searchTerm)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopySegment(segment)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}