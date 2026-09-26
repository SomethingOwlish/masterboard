-- Shared campaign documents (StorageGateway contract on D1).
CREATE TABLE IF NOT EXISTS documents (
  path TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS documents_collection ON documents (collection);

-- Who may open a campaign; derived from the campaign document on every write.
CREATE TABLE IF NOT EXISTS campaign_members (
  campaign_path TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (campaign_path, email)
);
CREATE INDEX IF NOT EXISTS campaign_members_email ON campaign_members (email);
