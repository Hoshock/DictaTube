export type WordDiffStatus = "correct" | "missing" | "extra"

export interface WordDiffToken {
  word: string
  status: WordDiffStatus
}

const WORD_SPLIT_PATTERN = /\s+/u
const NON_WORD_CHAR_PATTERN = /[^\p{L}\p{N}']/gu

export const normalizeWord = (word: string): string =>
  word.toLowerCase().replace(NON_WORD_CHAR_PATTERN, "")

const tokenize = (text: string): string[] => text.trim().split(WORD_SPLIT_PATTERN).filter(Boolean)

const buildLcsLengths = (expected: string[], typed: string[]): number[][] => {
  const lengths: number[][] = Array.from({ length: expected.length + 1 }, () =>
    Array.from({ length: typed.length + 1 }, () => 0),
  )

  for (let i = expected.length - 1; i >= 0; i -= 1) {
    for (let j = typed.length - 1; j >= 0; j -= 1) {
      const row = lengths[i]
      const nextRow = lengths[i + 1]
      if (!row || !nextRow) {
        continue
      }
      if (normalizeWord(expected[i] ?? "") === normalizeWord(typed[j] ?? "")) {
        row[j] = (nextRow[j + 1] ?? 0) + 1
      } else {
        row[j] = Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0)
      }
    }
  }

  return lengths
}

/**
 * LCSで単語列を揃える。位置ずれ(単語の抜け・言い足し)があっても
 * それ以降の単語を巻き込んで全部不正解にしないための整列。
 */
const backtrackTokens = (
  expected: string[],
  typed: string[],
  lengths: number[][],
): WordDiffToken[] => {
  const tokens: WordDiffToken[] = []
  let i = 0
  let j = 0

  while (i < expected.length && j < typed.length) {
    const expectedWord = expected[i]
    const typedWord = typed[j]
    if (expectedWord === undefined || typedWord === undefined) {
      break
    }

    if (normalizeWord(expectedWord) === normalizeWord(typedWord)) {
      tokens.push({ word: expectedWord, status: "correct" })
      i += 1
      j += 1
      continue
    }

    const skipExpected = lengths[i + 1]?.[j] ?? 0
    const skipTyped = lengths[i]?.[j + 1] ?? 0
    if (skipExpected >= skipTyped) {
      tokens.push({ word: expectedWord, status: "missing" })
      i += 1
    } else {
      tokens.push({ word: typedWord, status: "extra" })
      j += 1
    }
  }

  while (i < expected.length) {
    tokens.push({ word: expected[i] ?? "", status: "missing" })
    i += 1
  }

  while (j < typed.length) {
    tokens.push({ word: typed[j] ?? "", status: "extra" })
    j += 1
  }

  return tokens
}

export const diffWords = (expectedText: string, typedText: string): WordDiffToken[] => {
  const expected = tokenize(expectedText)
  const typed = tokenize(typedText)
  const lengths = buildLcsLengths(expected, typed)
  return backtrackTokens(expected, typed, lengths)
}

export const isPerfectMatch = (tokens: WordDiffToken[]): boolean =>
  tokens.length > 0 && tokens.every((token) => token.status === "correct")
