// Package indexed exposes Envio-owned chain facts. It never writes attendance or settlement state.
package indexed

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var walletAddress = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

// Register returns a cleanup function. Missing configuration yields 503, never fabricated data.
func Register(mux *http.ServeMux) (func(), error) {
	connection := os.Getenv("INDEXER_DATABASE_URL")
	if connection == "" {
		mux.HandleFunc("GET /v1/events", unavailable)
		mux.HandleFunc("GET /v1/events/{vault}", unavailable)
		mux.HandleFunc("GET /v1/events/{vault}/participants", unavailable)
		mux.HandleFunc("GET /v1/events/{vault}/activity", unavailable)
		return func() {}, nil
	}
	config, err := pgxpool.ParseConfig(connection)
	if err != nil {
		return nil, fmt.Errorf("invalid INDEXER_DATABASE_URL configuration")
	}
	if config.ConnConfig.Database != "commitpass_indexer" {
		return nil, fmt.Errorf("INDEXER_DATABASE_URL must use commitpass_indexer")
	}
	config.MaxConns = 2
	config.ConnConfig.RuntimeParams["default_transaction_read_only"] = "on"
	config.ConnConfig.ConnectTimeout = 5 * time.Second
	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, fmt.Errorf("cannot initialize indexer database pool")
	}
	routes := &reader{pool: pool}
	mux.HandleFunc("GET /v1/events", routes.events)
	mux.HandleFunc("GET /v1/events/{vault}", routes.event)
	mux.HandleFunc("GET /v1/events/{vault}/participants", routes.participants)
	mux.HandleFunc("GET /v1/events/{vault}/activity", routes.activity)
	return pool.Close, nil
}

type reader struct{ pool *pgxpool.Pool }

func unavailable(w http.ResponseWriter, _ *http.Request) {
	http.Error(w, "Indexed chain data is not available yet", http.StatusServiceUnavailable)
}

func respond(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(payload)
}

// Encode arbitrary-size onchain integers as decimal strings, preserving JavaScript precision.
const eventJSON = `to_jsonb(e) || jsonb_build_object(
    'eventId', e."eventId"::text, 'stakeAmount', e."stakeAmount"::text,
    'maxParticipant', e."maxParticipant"::text, 'registrationDeadline', e."registrationDeadline"::text,
    'startAt', e."startAt"::text, 'settleAt', e."settleAt"::text,
    'totalCommitted', e."totalCommitted"::text, 'yieldDeposited', e."yieldDeposited"::text,
    'totalYield', e."totalYield"::text, 'protocolFee', e."protocolFee"::text,
    'rewardPerAttendee', e."rewardPerAttendee"::text, 'totalClaimed', e."totalClaimed"::text,
    'createdAt', e."createdAt"::text, 'updatedAt', e."updatedAt"::text, 'lastBlock', e."lastBlock"::text)`

func key(w http.ResponseWriter, r *http.Request) (string, bool) {
	vault := r.PathValue("vault")
	if !walletAddress.MatchString(vault) {
		http.Error(w, "Invalid vault address", http.StatusBadRequest)
		return "", false
	}
	return "10143_" + strings.ToLower(vault), true
}

func (s *reader) events(w http.ResponseWriter, r *http.Request) {
	if raw := r.URL.Query().Get("wallets"); raw != "" {
		wallets := strings.Split(strings.ToLower(raw), ",")
		if len(wallets) > 20 {
			http.Error(w, "Too many wallet filters", http.StatusBadRequest)
			return
		}
		for _, wallet := range wallets {
			if !walletAddress.MatchString(wallet) {
				http.Error(w, "Invalid wallet filter", http.StatusBadRequest)
				return
			}
		}
		hosting := `lower(e.owner) = ANY($2::text[])`
		going := `EXISTS (SELECT 1 FROM envio."Participant" p WHERE p.event_id=e.id AND lower(p.wallet)=ANY($2::text[]))`
		filter := "(" + hosting + " OR " + going + ")"
		switch r.URL.Query().Get("role") {
		case "hosting":
			filter = hosting
		case "going":
			filter = going
		case "", "all":
		default:
			http.Error(w, "Invalid event role", http.StatusBadRequest)
			return
		}
		s.list(w, r, `SELECT `+eventJSON+` FROM envio."CommitmentEvent" e WHERE e."chainId"=10143 AND e.id>$1 AND `+filter+` ORDER BY e.id LIMIT 101`, r.URL.Query().Get("after"), wallets)
		return
	}
	s.list(w, r, `SELECT `+eventJSON+` FROM envio."CommitmentEvent" e WHERE e."chainId" = 10143 AND e.id > $1 ORDER BY e.id LIMIT 101`, r.URL.Query().Get("after"))
}

func (s *reader) event(w http.ResponseWriter, r *http.Request) {
	id, ok := key(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	var data json.RawMessage
	err := s.pool.QueryRow(ctx, `SELECT `+eventJSON+` FROM envio."CommitmentEvent" e WHERE e.id = $1`, id).Scan(&data)
	if err == pgx.ErrNoRows {
		http.Error(w, "Event not indexed", http.StatusNotFound)
		return
	}
	if err != nil {
		unavailable(w, r)
		return
	}
	respond(w, map[string]any{"source": "envio", "chainId": 10143, "data": data})
}

func (s *reader) participants(w http.ResponseWriter, r *http.Request) {
	id, ok := key(w, r)
	if !ok {
		return
	}
	s.list(w, r, `SELECT to_jsonb(p) || jsonb_build_object(
        'amount', p.amount::text, 'claimedAmount', p."claimedAmount"::text, 'depositedAt', p."depositedAt"::text,
        'claimableAmount', (CASE WHEN e.status = 'SETTLED' AND p.attended AND NOT p.claimed
            THEN e."rewardPerAttendee" ELSE 0 END)::text)
        FROM envio."Participant" p JOIN envio."CommitmentEvent" e ON e.id = p.event_id
        WHERE p.event_id = $1 AND p.id > $2 ORDER BY p.id LIMIT 101`, id, r.URL.Query().Get("after"))
}

func (s *reader) activity(w http.ResponseWriter, r *http.Request) {
	id, ok := key(w, r)
	if !ok {
		return
	}
	s.list(w, r, `SELECT to_jsonb(a) || jsonb_build_object(
        'blockNumber', a."blockNumber"::text, 'timestamp', a.timestamp::text, 'amount', a.amount::text)
        FROM envio."ChainActivity" a WHERE a.event_id = $1 AND a.id > $2 ORDER BY a.id LIMIT 101`, id, r.URL.Query().Get("after"))
}

func (s *reader) list(w http.ResponseWriter, r *http.Request, query string, args ...any) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		unavailable(w, r)
		return
	}
	defer rows.Close()
	data := make([]json.RawMessage, 0, 100)
	hasMore := false
	for rows.Next() {
		if len(data) == 100 {
			hasMore = true
			break
		}
		var row json.RawMessage
		if err := rows.Scan(&row); err != nil {
			unavailable(w, r)
			return
		}
		data = append(data, row)
	}
	if rows.Err() != nil {
		unavailable(w, r)
		return
	}
	var nextCursor *string
	if hasMore {
		var last struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(data[len(data)-1], &last); err != nil {
			unavailable(w, r)
			return
		}
		nextCursor = &last.ID
	}
	respond(w, map[string]any{"source": "envio", "chainId": 10143, "data": data, "nextCursor": nextCursor})
}
