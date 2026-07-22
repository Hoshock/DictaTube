import { describe, expect, it } from "vitest"

import type { Chunk, Word } from "./types"
import { chunkWords, parseJson3Captions } from "./chunker"

const FIRST_INDEX = 0
const SECOND_INDEX = 1
const ONE_CHUNK = 1
const TWO_CHUNKS = 2
const MIN_DURATION_MS = 8000
const MIN_PAUSE_MS = 350

const makeWord = (text: string, startMs: number, endMs: number): Word => ({ text, startMs, endMs })

const wordAt = (words: Word[], index: number): Word => {
  const word = words[index]
  if (!word) {
    throw new Error("expected word at index")
  }
  return word
}

const chunkAt = (chunks: Chunk[], index: number): Chunk => {
  const chunk = chunks[index]
  if (!chunk) {
    throw new Error("expected chunk at index")
  }
  return chunk
}

describe("parseJson3Captions", () => {
  it("splits segments into words and excludes aAppend events", () => {
    const firstEventStartMs = 0
    const appendEventStartMs = 500
    const appendFlag = 1
    const secondEventStartMs = 1000
    const secondSegOffsetMs = 200

    const words = parseJson3Captions({
      events: [
        {
          tStartMs: firstEventStartMs,
          segs: [{ utf8: "hello world" }],
        },
        {
          tStartMs: appendEventStartMs,
          aAppend: appendFlag,
          segs: [{ utf8: "duplicated rolling text" }],
        },
        {
          tStartMs: secondEventStartMs,
          segs: [{ utf8: "second" }, { utf8: "line", tOffsetMs: secondSegOffsetMs }],
        },
      ],
    })

    expect(words.map((word) => word.text)).toEqual(["hello", "world", "second", "line"])
    expect(words.map((word) => word.startMs)).toEqual([
      firstEventStartMs,
      firstEventStartMs,
      secondEventStartMs,
      secondEventStartMs + secondSegOffsetMs,
    ])
  })

  it("fills each word's endMs with the next word's startMs", () => {
    const eventStartMs = 0

    const words = parseJson3Captions({
      events: [{ tStartMs: eventStartMs, segs: [{ utf8: "a b c" }] }],
    })

    expect(wordAt(words, FIRST_INDEX).endMs).toBe(eventStartMs)
    expect(wordAt(words, SECOND_INDEX).endMs).toBe(eventStartMs)
  })
})

describe("chunkWords boundary conditions", () => {
  it("does not split before the minimum duration even with a long pause", () => {
    const firstWordEndMs = 1000
    const secondWordStartMs = 2000
    const secondWordEndMs = 3000
    const words = [
      makeWord("a", FIRST_INDEX, firstWordEndMs),
      makeWord("b", secondWordStartMs, secondWordEndMs),
    ]

    const chunks = chunkWords(words, { minDurationMs: MIN_DURATION_MS, minPauseMs: MIN_PAUSE_MS })

    expect(chunks).toHaveLength(ONE_CHUNK)
    expect(chunkAt(chunks, FIRST_INDEX).text).toBe("a b")
  })

  it("does not split at the minimum duration without a pause", () => {
    const secondWordEndMs = 9000
    const words = [
      makeWord("a", FIRST_INDEX, MIN_DURATION_MS),
      makeWord("b", MIN_DURATION_MS, secondWordEndMs),
    ]

    const chunks = chunkWords(words, { minDurationMs: MIN_DURATION_MS, minPauseMs: MIN_PAUSE_MS })

    expect(chunks).toHaveLength(ONE_CHUNK)
  })
})

describe("chunkWords boundary crossed", () => {
  it("splits once both the duration and pause thresholds are met", () => {
    const secondWordStartMs = 8400
    const secondWordEndMs = 9000
    const thirdWordEndMs = 9500
    const words = [
      makeWord("a", FIRST_INDEX, MIN_DURATION_MS),
      makeWord("b", secondWordStartMs, secondWordEndMs),
      makeWord("c", secondWordEndMs, thirdWordEndMs),
    ]

    const chunks = chunkWords(words, { minDurationMs: MIN_DURATION_MS, minPauseMs: MIN_PAUSE_MS })

    expect(chunks).toHaveLength(TWO_CHUNKS)
    expect(chunkAt(chunks, FIRST_INDEX)).toMatchObject({
      index: FIRST_INDEX,
      startMs: FIRST_INDEX,
      endMs: MIN_DURATION_MS,
      text: "a",
    })
    expect(chunkAt(chunks, SECOND_INDEX)).toMatchObject({
      index: SECOND_INDEX,
      startMs: secondWordStartMs,
      endMs: thirdWordEndMs,
      text: "b c",
    })
  })
})

describe("chunkWords with no words", () => {
  it("returns an empty array", () => {
    expect(chunkWords([])).toEqual([])
  })
})
