CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  youtube_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
