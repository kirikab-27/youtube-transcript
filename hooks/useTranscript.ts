import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TranscriptData, TranscriptRequest, ApiResponse } from '@/types/transcript.types'

// API functions
const fetchTranscript = async (request: TranscriptRequest): Promise<TranscriptData> => {
  const response = await fetch('/api/transcript', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const result: ApiResponse<TranscriptData> = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch transcript')
  }

  if (!result.data) {
    throw new Error('No transcript data received')
  }

  return result.data
}

const getTranscriptHistory = async (): Promise<TranscriptData[]> => {
  const response = await fetch('/api/transcript/history')

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const result: ApiResponse<TranscriptData[]> = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch transcript history')
  }

  return result.data || []
}

// Custom hooks
export const useTranscript = () => {
  const queryClient = useQueryClient()

  const transcriptMutation = useMutation({
    mutationFn: fetchTranscript,
    onSuccess: (data) => {
      // Invalidate history query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['transcript-history'] })

      // Update the cache with the new transcript
      queryClient.setQueryData(['transcript', data.videoId], data)
    },
  })

  const generateTranscript = (request: TranscriptRequest) => {
    return transcriptMutation.mutate(request)
  }

  return {
    generateTranscript,
    isLoading: transcriptMutation.isPending,
    isError: transcriptMutation.isError,
    isSuccess: transcriptMutation.isSuccess,
    data: transcriptMutation.data,
    error: transcriptMutation.error?.message,
    reset: transcriptMutation.reset,
  }
}

export const useTranscriptHistory = () => {
  return useQuery({
    queryKey: ['transcript-history'],
    queryFn: getTranscriptHistory,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

export const useTranscriptById = (videoId: string | null) => {
  return useQuery({
    queryKey: ['transcript', videoId],
    queryFn: async () => {
      if (!videoId) throw new Error('Video ID is required')

      const response = await fetch(`/api/transcript/${videoId}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse<TranscriptData> = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch transcript')
      }

      return result.data
    },
    enabled: !!videoId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}