CREATE TABLE IF NOT EXISTS lost_found_posts (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('lost', 'found')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  posted_by TEXT NOT NULL DEFAULT 'You',
  contact TEXT NOT NULL,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lost_found_posts_status ON lost_found_posts (status);
CREATE INDEX IF NOT EXISTS idx_lost_found_posts_created_at ON lost_found_posts (created_at DESC);
