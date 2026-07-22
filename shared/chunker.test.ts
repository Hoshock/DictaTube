import { describe, expect, it } from "vitest"

import { chunkWords, parseJson3Captions } from "./chunker"
import type { Word } from "./types"

describe("parseJson3Captions", () => {
  it("splits segments into words and excludes aAppend events", () => {
    const words = parseJson3Captions({
      events: [
        {
          tStartMs: 0,
          segs: [{ utf8: "hello world" }],
        },
        {
          tStartMs: 500,
          aAppend: 1,
          segs: [{ utf8: "duplicated rolling text" }],
        },
        {
          tStartMs: 1000,
          segs: [{ utf8: "second", tOffsetMs: 0 }, { utf8: "line", tOffsetMs: 200 }],
        },
      ],
    })

    expect(words.map((w) => w.text)).toEqual(["hello", "world", "second", "line"])
    expect(words.map((w) => w.startMs)).toEqual([0, 0, 1000, 1200])
  })

  it("fills each word's endMs with the next word's startMs", () => {
    const words = parseJson3Captions({
      events: [{ tStartMs: 0, segs: [{ utf8: "a b c" }] }],
    })

    expect(words[0]?.endMs).toBe(0)
    expect(words[1]?.endMs).toBe(0)
    expect(words[2]?.endMs).toBe(0)
  })
})

describe("chunkWords", () => {
  function word(text: string, startMs: number, endMs: number): Word {
    return { text, startMs, endMs }
  }

  it("does not split before the minimum duration even with a long pause", () => {
    const words = [word("a", 0, 1000), word("b", 2000, 3000)]

    const chunks = chunkWords(words, { minDurationMs: 8000, minPauseMs: 350 })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.text).toBe("a b")
  })

  it("does not split at the minimum duration without a pause", () => {
    const words = [word("a", 0, 8000), word("b", 8000, 9000)]

    const chunks = chunkWords(words, { minDurationMs: 8000, minPauseMs: 350 })

    expect(chunks).toHaveLength(1)
  })

  it("splits once both the duration and pause thresholds are met", () => {
    const words = [
      word("a", 0, 8000),
      word("b", 8400, 9000),
      word("c", 9000, 9500),
    ]

    const chunks = chunkWords(words, { minDurationMs: 8000, minPauseMs: 350 })

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toMatchObject({ index: 0, startMs: 0, endMs: 8000, text: "a" })
    expect(chunks[1]).toMatchObject({ index: 1, startMs: 8400, endMs: 9500, text: "b c" })
  })

  it("returns an empty array for no words", () => {
    expect(chunkWords([])).toEqual([])
  })
})
