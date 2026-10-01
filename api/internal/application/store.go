package application

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/EndPx/commitpass/api/internal/auth"
	"github.com/EndPx/commitpass/api/internal/chain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func OpenDatabase(ctx context.Context) (*pgxpool.Pool, error) {
	raw := os.Getenv("DATABASE_URL")
	if raw == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	config, err := pgxpool.ParseConfig(raw)
	if err != nil {
		return nil, fmt.Errorf("invalid application database configuration")
	}
	if config.ConnConfig.Database == "commitpass_indexer" {
		return nil, fmt.Errorf("application data must use a separate database")
	}
	config.MaxConns = 5
	config.ConnConfig.ConnectTimeout = 5 * time.Second
	return pgxpool.NewWithConfig(ctx, config)
}

func syncIdentity(ctx context.Context, pool *database, user auth.Principal) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `INSERT INTO app.users AS existing(privy_id,display_name) VALUES($1,$2)
        ON CONFLICT(privy_id) DO UPDATE SET last_seen_at=clock_timestamp(),
        display_name=CASE WHEN EXCLUDED.display_name<>'' THEN EXCLUDED.display_name ELSE existing.display_name END`, user.ID, user.Name); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE app.wallet_links SET active=false WHERE privy_id=$1`, user.ID); err != nil {
		return err
	}
	for _, wallet := range user.Wallets {
		if _, err = tx.Exec(ctx, `INSERT INTO app.wallet_links(privy_id,wallet) VALUES($1,$2)
            ON CONFLICT(privy_id,wallet) DO UPDATE SET active=true,verified_at=clock_timestamp()`, user.ID, wallet); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// Event row locks serialize check-in writes with snapshot creation.
func lockEvent(ctx context.Context, tx pgx.Tx, event chain.Event, chainID uint64) (*string, error) {
	vault := strings.ToLower(event.Vault.Hex())
	if _, err := tx.Exec(ctx, `INSERT INTO app.events(chain_id,vault,event_number) VALUES($1,$2,$3::numeric)
        ON CONFLICT(chain_id,vault) DO NOTHING`, int64(chainID), vault, event.ID.String()); err != nil {
		return nil, err
	}
	var frozen *string
	var number string
	err := tx.QueryRow(ctx, `SELECT frozen_cutoff::text,event_number::text FROM app.events WHERE chain_id=$1 AND vault=$2 FOR UPDATE`, int64(chainID), vault).Scan(&frozen, &number)
	if err != nil {
		return nil, err
	}
	if number != event.ID.String() {
		return nil, fmt.Errorf("event identity changed")
	}
	return frozen, nil
}
