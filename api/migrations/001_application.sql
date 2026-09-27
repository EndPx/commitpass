CREATE TABLE app.users (
    privy_id text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE app.wallet_links (
    privy_id text NOT NULL REFERENCES app.users(privy_id),
    wallet text NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
    active boolean NOT NULL DEFAULT true,
    verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (privy_id, wallet)
);

CREATE TABLE app.events (
    chain_id bigint NOT NULL,
    vault text NOT NULL CHECK (vault ~ '^0x[0-9a-f]{40}$'),
    event_number numeric(78,0) NOT NULL,
    title text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    location text NOT NULL DEFAULT '',
    poster_url text NOT NULL DEFAULT '',
    updated_by text REFERENCES app.users(privy_id),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    frozen_cutoff numeric(78,0),
    PRIMARY KEY (chain_id, vault)
);

CREATE TABLE app.check_ins (
    chain_id bigint NOT NULL,
    vault text NOT NULL,
    wallet text NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
    recorded_by text NOT NULL REFERENCES app.users(privy_id),
    owner_wallet text NOT NULL,
    checked_in_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    observed_block bigint NOT NULL,
    observed_block_hash text NOT NULL,
    PRIMARY KEY (chain_id, vault, wallet),
    FOREIGN KEY (chain_id, vault) REFERENCES app.events(chain_id, vault)
);

CREATE TABLE app.attendance_snapshots (
    chain_id bigint NOT NULL,
    vault text NOT NULL,
    event_number numeric(78,0) NOT NULL,
    cutoff numeric(78,0) NOT NULL,
    payload jsonb NOT NULL,
    snapshot_hash text NOT NULL CHECK (snapshot_hash ~ '^0x[0-9a-f]{64}$'),
    anchor_block bigint NOT NULL,
    anchor_block_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (chain_id, vault),
    FOREIGN KEY (chain_id, vault) REFERENCES app.events(chain_id, vault)
);

CREATE FUNCTION app.reject_attendance_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Attendance records are append-only';
END;
$$;

CREATE TRIGGER check_ins_immutable BEFORE UPDATE OR DELETE ON app.check_ins
    FOR EACH ROW EXECUTE FUNCTION app.reject_attendance_mutation();
CREATE TRIGGER snapshots_immutable BEFORE UPDATE OR DELETE ON app.attendance_snapshots
    FOR EACH ROW EXECUTE FUNCTION app.reject_attendance_mutation();

-- Serialize inserts and freezing on the same event row, including non-HTTP writers.
CREATE FUNCTION app.guard_check_in() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE frozen numeric;
BEGIN
    SELECT frozen_cutoff INTO frozen FROM app.events
      WHERE chain_id = NEW.chain_id AND vault = NEW.vault FOR UPDATE;
    IF frozen IS NOT NULL THEN RAISE EXCEPTION 'Attendance already frozen'; END IF;
    NEW.checked_in_at := clock_timestamp();
    RETURN NEW;
END;
$$;
CREATE TRIGGER check_in_guard BEFORE INSERT ON app.check_ins
    FOR EACH ROW EXECUTE FUNCTION app.guard_check_in();
