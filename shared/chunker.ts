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

const NO_OFFSET_MS = 0
const FIRST_INDEX = 0
const LAST_INDEX_OFFSET = -1
const INDEX_STEP = 1
const EMPTY_LENGTH = 0

const tokenizeSegment = (segment: Json3Segment, eventStartMs: number): Word[] => {
  const startMs = eventStartMs + (segment.tOffsetMs ?? NO_OFFSET_MS)

  return segment.utf8
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((text) => ({ text, startMs, endMs: startMs }))
}

const fillWordEndTimes = (words: Word[]): Word[] =>
  words.map((word, wordIndex) => {
    const nextWord = words[wordIndex + INDEX_STEP]
    if (!nextWord) {
      return word
    }
    return Object.assign({}, word, { endMs: nextWord.startMs })
  })

/**
 * ローリング表示の自動字幕は前後のイベントで単語が重複するため、
 * aAppend イベントを除外して単語ストリームに復元する (docs/design.md 参照)。
 */
export const parseJson3Captions = (captions: Json3Captions): Word[] => {
  const words = captions.events
    .filter((event) => !event.aAppend && event.segs)
    .flatMap((event) =>
      (event.segs ?? []).flatMap((segment) => tokenizeSegment(segment, event.tStartMs)),
    )

  return fillWordEndTimes(words)
}

export interface ChunkOptions {
  minDurationMs?: number
  minPauseMs?: number
}

const DEFAULT_MIN_DURATION_MS = 8000
const DEFAULT_MIN_PAUSE_MS = 350

interface BoundaryCheck {
  word: Word
  nextWord: Word
  chunkStart: Word
}

const getBoundaryCheck = (
  words: Word[],
  wordIndex: number,
  chunkStartIndex: number,
): BoundaryCheck | undefined => {
  const word = words[wordIndex]
  const nextWord = words[wordIndex + INDEX_STEP]
  const chunkStart = words[chunkStartIndex]
  if (!word || !nextWord || !chunkStart) {
    return
  }
  return { word, nextWord, chunkStart }
}

const isBoundary = (check: BoundaryCheck, minDurationMs: number, minPauseMs: number): boolean => {
  const duration = check.word.endMs - check.chunkStart.startMs
  const pause = check.nextWord.startMs - check.word.endMs
  return duration >= minDurationMs && pause >= minPauseMs
}

const findBoundaryIndices = (
  words: Word[],
  minDurationMs: number,
  minPauseMs: number,
): number[] => {
  const lastWordIndex = words.length - INDEX_STEP
  const boundaries: number[] = []
  let chunkStartIndex = FIRST_INDEX

  for (let wordIndex = FIRST_INDEX; wordIndex < lastWordIndex; wordIndex += INDEX_STEP) {
    const check = getBoundaryCheck(words, wordIndex, chunkStartIndex)
    if (check && isBoundary(check, minDurationMs, minPauseMs)) {
      boundaries.push(wordIndex)
      chunkStartIndex = wordIndex + INDEX_STEP
    }
  }

  return [...boundaries, lastWordIndex]
}

interface ChunkRange {
  start: number
  end: number
}

const toChunkRanges = (boundaries: number[]): ChunkRange[] => {
  const ranges: ChunkRange[] = []
  let rangeStart = FIRST_INDEX
  for (const boundaryEnd of boundaries) {
    ranges.push({ start: rangeStart, end: boundaryEnd })
    rangeStart = boundaryEnd + INDEX_STEP
  }
  return ranges
}

const buildChunk = (words: Word[], range: ChunkRange, chunkIndex: number): Chunk | undefined => {
  const slice = words.slice(range.start, range.end + INDEX_STEP)
  const [first] = slice
  const last = slice.at(LAST_INDEX_OFFSET)
  if (!first || !last) {
    return
  }

  return {
    index: chunkIndex,
    startMs: first.startMs,
    endMs: last.endMs,
    text: slice.map((word) => word.text).join(" "),
  }
}

const isChunk = (chunk: Chunk | undefined): chunk is Chunk => typeof chunk !== "undefined"

/**
 * 「約 8 秒たまり、かつ 0.35 秒以上の発話の切れ目」でチャンクに分割する。
 * どちらか一方だけでは区切らない (docs/design.md 参照)。
 */
export const chunkWords = (words: Word[], options: ChunkOptions = {}): Chunk[] => {
  const minDurationMs = options.minDurationMs ?? DEFAULT_MIN_DURATION_MS
  const minPauseMs = options.minPauseMs ?? DEFAULT_MIN_PAUSE_MS

  if (words.length === EMPTY_LENGTH) {
    return []
  }

  const boundaries = findBoundaryIndices(words, minDurationMs, minPauseMs)
  const ranges = toChunkRanges(boundaries)

  return ranges
    .map((range, chunkIndex) => buildChunk(words, range, chunkIndex))
    .filter((chunk) => isChunk(chunk))
}
