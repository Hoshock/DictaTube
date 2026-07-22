-- positionは並び順キー(値が小さいほど上位)。新規作成時はアプリ側で-Date.now()相当の
-- 十分小さい値を入れ、既存行に触れずに常に先頭へ来るようにする。ドラッグ並び替え時は
-- 対象リストの全行を0..N-1で振り直す (worker/routes/*.ts参照)。
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  youtube_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE playlist_videos (
  playlist_id TEXT NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, video_id)
);

CREATE TABLE chunks (
  video_id TEXT NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (video_id, chunk_index)
);

CREATE TABLE progress (
  video_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  cleared INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (video_id, chunk_index),
  FOREIGN KEY (video_id, chunk_index) REFERENCES chunks (video_id, chunk_index) ON DELETE CASCADE
);
