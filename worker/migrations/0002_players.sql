-- Player profiles shared by every signed-in master (ТЗ-2, R11).
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

-- A master's own note about a player; only its author ever reads it.
CREATE TABLE IF NOT EXISTS player_notes (
  player_id TEXT NOT NULL,
  email TEXT NOT NULL,
  text TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player_id, email)
);
