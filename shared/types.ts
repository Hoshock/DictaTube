export interface Video {
  id: string
  youtubeId: string
  title: string
  durationMs: number
  createdAt: string
}

export interface Word {
  text: string
  startMs: number
  endMs: number
}

export interface Chunk {
  index: number
  startMs: number
  endMs: number
  text: string
}

export interface Progress {
  videoId: string
  chunkIndex: number
  cleared: boolean
  attempts: number
  updatedAt: string
}
