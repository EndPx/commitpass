ALTER TABLE app.events
    ADD COLUMN timezone text NOT NULL DEFAULT 'UTC',
    ADD COLUMN appearance jsonb NOT NULL DEFAULT '{"style":"minimal","color":"#b9462d","font":"sans","mode":"light"}'::jsonb;
