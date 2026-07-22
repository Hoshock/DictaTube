// positionは並び順キー(値が小さいほど上位)。新規追加時はこの値を使うことで、
// 既存行のpositionに一切触れずに常に一覧の先頭へ来る。ドラッグ並び替え後は
// 対象リストの全行を0..N-1で振り直すため、以降そのグループより先頭に来る。
export const nextTopPosition = (): number => -Date.now()
