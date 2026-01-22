export interface TranscriptSegment {
  id: string
  start: number
  end: number
  text: string
  confidence?: number
}

export interface TranscriptData {
  id?: string
  videoId: string
  title: string
  duration: number
  segments: TranscriptSegment[]
  language?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface TranscriptResponse {
  success: boolean
  data?: TranscriptData
  error?: string
}

export interface VideoInfo {
  id: string
  title: string
  duration: number
  thumbnail?: string
  channelName?: string
  publishedAt?: Date
}

export interface TranscriptRequest {
  url: string
  language?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export type TranscriptStatus = 'idle' | 'loading' | 'success' | 'error'

export interface TranscriptState {
  status: TranscriptStatus
  data: TranscriptData | null
  error: string | null
}