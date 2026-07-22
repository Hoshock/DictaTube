import { describe, expect, it } from "vitest"

import { diffWords, isPerfectMatch, normalizeWord } from "./dictation"

describe("normalizeWord", () => {
  it("lowercases and strips punctuation but keeps apostrophes", () => {
    expect(normalizeWord("Hello,")).toBe("hello")
    expect(normalizeWord("don't")).toBe("don't")
  })
})

describe("diffWords", () => {
  it("marks every word correct on an exact match", () => {
    const tokens = diffWords("hello and welcome", "hello and welcome")

    expect(tokens).toEqual([
      { word: "hello", status: "correct" },
      { word: "and", status: "correct" },
      { word: "welcome", status: "correct" },
    ])
    expect(isPerfectMatch(tokens)).toBe(true)
  })

  it("ignores case and trailing punctuation differences", () => {
    const tokens = diffWords("hello world", "Hello, world.")

    expect(tokens).toEqual([
      { word: "hello", status: "correct" },
      { word: "world", status: "correct" },
    ])
    expect(isPerfectMatch(tokens)).toBe(true)
  })

  it("flags a wrong word without misaligning the rest", () => {
    const tokens = diffWords("listening and dictation practice", "listening and diction practice")

    expect(tokens).toEqual([
      { word: "listening", status: "correct" },
      { word: "and", status: "correct" },
      { word: "dictation", status: "missing" },
      { word: "diction", status: "extra" },
      { word: "practice", status: "correct" },
    ])
    expect(isPerfectMatch(tokens)).toBe(false)
  })

  it("marks a skipped word as missing without breaking later alignment", () => {
    const tokens = diffWords("today we are going to talk", "today we going to talk")

    expect(tokens).toEqual([
      { word: "today", status: "correct" },
      { word: "we", status: "correct" },
      { word: "are", status: "missing" },
      { word: "going", status: "correct" },
      { word: "to", status: "correct" },
      { word: "talk", status: "correct" },
    ])
  })

  it("marks an extra typed word as extra", () => {
    const tokens = diffWords("hello world", "hello there world")

    expect(tokens).toEqual([
      { word: "hello", status: "correct" },
      { word: "there", status: "extra" },
      { word: "world", status: "correct" },
    ])
  })

  it("treats an empty typed answer as all missing", () => {
    const tokens = diffWords("hello world", "")

    expect(tokens).toEqual([
      { word: "hello", status: "missing" },
      { word: "world", status: "missing" },
    ])
    expect(isPerfectMatch(tokens)).toBe(false)
  })
})

describe("isPerfectMatch", () => {
  it("is false for an empty token list", () => {
    expect(isPerfectMatch([])).toBe(false)
  })
})
