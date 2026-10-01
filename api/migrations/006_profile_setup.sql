ALTER TABLE app.users ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;
