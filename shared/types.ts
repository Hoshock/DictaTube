export interface Video {
  id: string
  youtubeId: string
  title: string
  durationMs: number
  createdAt: string
  playlistIds: string[]
  /** 並び順キー。値が小さいほど上に表示される。未分類一覧での並び替えに使う。 */
  position: number
}

export interface Playlist {
  id: string
  name: string
  createdAt: string
  /** 並び順キー。値が小さいほど上に表示される。 */
  position: number
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
