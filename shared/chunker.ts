import type { Chunk, Word } from "./types"

export interface Json3Segment {
  utf8: string
  tOffsetMs?: number
}

export interface Json3Event {
  tStartMs: number
  dDurationMs?: number
  segs?: Json3Segment[]
  aAppend?: number
}

export interface Json3Captions {
  events: Json3Event[]
}

/**
 * ローリング表示の自動字幕は前後のイベントで単語が重複するため、
 * aAppend イベントを除外して単語ストリームに復元する (docs/design.md 参照)。
 */
export function parseJson3Captions(captions: Json3Captions): Word[] {
  const words: Word[] = []

  for (const event of captions.events) {
    if (event.aAppend || !event.segs) {
      continue
    }

    for (const seg of event.segs) {
      const startMs = event.tStartMs + (seg.tOffsetMs ?? 0)

      for (const token of seg.utf8.trim().split(/\s+/)) {
        if (token === "") {
          continue
        }
        words.push({ text: token, startMs, endMs: startMs })
      }
    }
  }

  return fillWordEndTimes(words)
}

function fillWordEndTimes(words: Word[]): Word[] {
  return words.map((word, index) => {
    const nextWord = words[index + 1]
    return nextWord ? { ...word, endMs: nextWord.startMs } : word
  })
}

export interface ChunkOptions {
  minDurationMs?: number
  minPauseMs?: number
}

const DEFAULT_MIN_DURATION_MS = 8000
const DEFAULT_MIN_PAUSE_MS = 350

/**
 * 「約 8 秒たまり、かつ 0.35 秒以上の発話の切れ目」でチャンクに分割する。
 * どちらか一方だけでは区切らない (docs/design.md 参照)。
 */
export function chunkWords(words: Word[], options: ChunkOptions = {}): Chunk[] {
  const minDurationMs = options.minDurationMs ?? DEFAULT_MIN_DURATION_MS
  const minPauseMs = options.minPauseMs ?? DEFAULT_MIN_PAUSE_MS

  if (words.length === 0) {
    return []
  }

  const boundaries: number[] = []
  let chunkStartIndex = 0

  for (let i = 0; i < words.length - 1; i++) {
    const word = words[i]
    const nextWord = words[i + 1]
    const chunkStart = words[chunkStartIndex]
    if (!word || !nextWord || !chunkStart) {
      continue
    }

    const duration = word.endMs - chunkStart.startMs
    const pause = nextWord.startMs - word.endMs

    if (duration >= minDurationMs && pause >= minPauseMs) {
      boundaries.push(i)
      chunkStartIndex = i + 1
    }
  }
  boundaries.push(words.length - 1)

  const chunks: Chunk[] = []
  let start = 0
  for (const [index, end] of boundaries.entries()) {
    const slice = words.slice(start, end + 1)
    const first = slice[0]
    const last = slice[slice.length - 1]
    if (first && last) {
      chunks.push({
        index,
        startMs: first.startMs,
        endMs: last.endMs,
        text: slice.map((w) => w.text).join(" "),
      })
    }
    start = end + 1
  }

  return chunks
}
