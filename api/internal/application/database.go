package application

import (
	"context"
	"github.com/EndPx/commitpass/packages/shared"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"strings"
)

// Qualify every query explicitly; transaction-pooler search_path is not relied on.
type database struct {
	*pgxpool.Pool
	schema string
}

func scopedDatabase(pool *pgxpool.Pool) (*database, error) {
	schema, _, err := shared.LocalSchemas()
	if err != nil {
		return nil, err
	}
	return &database{Pool: pool, schema: pgx.Identifier{schema}.Sanitize()}, nil
}
func (db *database) sql(query string) string { return strings.ReplaceAll(query, "app.", db.schema+".") }
func (db *database) Query(ctx context.Context, query string, args ...any) (pgx.Rows, error) {
	return db.Pool.Query(ctx, db.sql(query), args...)
}
func (db *database) QueryRow(ctx context.Context, query string, args ...any) pgx.Row {
	return db.Pool.QueryRow(ctx, db.sql(query), args...)
}
func (db *database) Begin(ctx context.Context) (pgx.Tx, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	return &scopedTx{Tx: tx, schema: db.schema}, nil
}

type scopedTx struct {
	pgx.Tx
	schema string
}

func (tx *scopedTx) sql(query string) string { return strings.ReplaceAll(query, "app.", tx.schema+".") }
func (tx *scopedTx) Exec(ctx context.Context, query string, args ...any) (pgconn.CommandTag, error) {
	return tx.Tx.Exec(ctx, tx.sql(query), args...)
}
func (tx *scopedTx) QueryRow(ctx context.Context, query string, args ...any) pgx.Row {
	return tx.Tx.QueryRow(ctx, tx.sql(query), args...)
}
func (tx *scopedTx) Query(ctx context.Context, query string, args ...any) (pgx.Rows, error) {
	return tx.Tx.Query(ctx, tx.sql(query), args...)
}
