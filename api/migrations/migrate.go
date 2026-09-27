package migrations

import (
	"bytes"
	"context"
	"crypto/sha256"
	"embed"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed *.sql
var files embed.FS

func Apply(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(677108141); CREATE SCHEMA IF NOT EXISTS app;
        CREATE TABLE IF NOT EXISTS app.schema_migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp());`); err != nil {
		return err
	}
	entries, err := files.ReadDir(".")
	if err != nil {
		return err
	}
	for _, entry := range entries {
		body, err := files.ReadFile(entry.Name())
		if err != nil {
			return err
		}
		body = bytes.ReplaceAll(body, []byte("\r\n"), []byte("\n"))
		checksum := fmt.Sprintf("%x", sha256.Sum256(body))
		var previous string
		err = tx.QueryRow(ctx, `SELECT checksum FROM app.schema_migrations WHERE version=$1`, entry.Name()).Scan(&previous)
		if err == nil {
			if previous != checksum {
				return fmt.Errorf("migration changed after application: %s", entry.Name())
			}
			continue
		}
		if err != pgx.ErrNoRows {
			return err
		}
		if _, err = tx.Exec(ctx, string(body)); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO app.schema_migrations(version,checksum) VALUES($1,$2)`, entry.Name(), checksum); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
