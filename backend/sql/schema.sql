CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  cleaned_text TEXT NOT NULL,
  content_hash VARCHAR(64) UNIQUE NOT NULL,
  similarity_score FLOAT DEFAULT 0,
  matched_document_id INT REFERENCES documents(id) ON DELETE SET NULL,
  is_flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fingerprints (
  id SERIAL PRIMARY KEY,
  document_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  hash_value VARCHAR(32) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fingerprints_hash_value ON fingerprints(hash_value);
CREATE INDEX IF NOT EXISTS idx_fingerprints_document_id ON fingerprints(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_flagged_score ON documents(is_flagged, similarity_score);
