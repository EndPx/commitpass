package application

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/EndPx/commitpass/api/internal/auth"
	"github.com/EndPx/commitpass/api/internal/chain"
	"github.com/ethereum/go-ethereum/common"
	"github.com/jackc/pgx/v5"
)

type service struct {
	db             *database
	privy          *auth.Privy
	chain          *chain.Client
	snapshotSecret [32]byte
}
type principalKey struct{}

func Register(mux *http.ServeMux) (func(), error) {
	if os.Getenv("DATABASE_URL") == "" {
		mux.HandleFunc("PUT /v1/me", func(w http.ResponseWriter, r *http.Request) { problem(w, 503, "Application backend is not configured") })
		for _, pattern := range []string{"POST /v1/session", "GET /v1/me", "GET /v1/events/{vault}/attendance/{wallet}", "GET /v1/events/{vault}/metadata", "PUT /v1/events/{vault}/metadata", "GET /v1/events/{vault}/check-ins", "PUT /v1/events/{vault}/check-ins/{wallet}", "GET /v1/attendance-snapshots/{chainId}/{vault}/{eventId}/{cutoff}", "POST /v1/attendance-snapshots/{chainId}/{vault}/{eventId}/{cutoff}"} {
			mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) { problem(w, 503, "Application backend is not configured") })
		}
		return func() {}, nil
	}
	db, err := OpenDatabase(context.Background())
	if err != nil {
		return nil, err
	}
	rpc := os.Getenv("MONAD_RPC_URL")
	if rpc == "" {
		rpc = "https://testnet-rpc.monad.xyz"
	}
	blockchain, err := chain.New(rpc)
	if err != nil {
		db.Close()
		return nil, err
	}
	privy, err := auth.NewPrivy(os.Getenv("PRIVY_APP_ID"), os.Getenv("PRIVY_APP_SECRET"))
	if err != nil {
		db.Close()
		return nil, err
	}
	secret := os.Getenv("ATTENDANCE_API_TOKEN")
	if len(secret) < 32 {
		db.Close()
		return nil, errors.New("ATTENDANCE_API_TOKEN must contain at least 32 characters")
	}
	scoped, err := scopedDatabase(db)
	if err != nil {
		db.Close()
		return nil, err
	}
	s := &service{db: scoped, privy: privy, chain: blockchain, snapshotSecret: sha256.Sum256([]byte(secret))}
	mux.Handle("GET /v1/events/{vault}/attendance/{wallet}", s.authenticated(http.HandlerFunc(s.ownAttendance)))
	mux.Handle("POST /v1/session", s.authenticated(http.HandlerFunc(s.me)))
	mux.Handle("GET /v1/me", s.authenticated(http.HandlerFunc(s.me)))
	mux.Handle("PUT /v1/me", s.authenticated(http.HandlerFunc(s.saveProfile)))
	mux.HandleFunc("GET /v1/events/{vault}/metadata", s.metadata)
	mux.Handle("PUT /v1/events/{vault}/metadata", s.authenticated(http.HandlerFunc(s.saveMetadata)))
	mux.Handle("GET /v1/events/{vault}/check-ins", s.authenticated(http.HandlerFunc(s.checkIns)))
	mux.Handle("PUT /v1/events/{vault}/check-ins/{wallet}", s.authenticated(http.HandlerFunc(s.checkIn)))
	mux.HandleFunc("GET /v1/attendance-snapshots/{chainId}/{vault}/{eventId}/{cutoff}", s.snapshot)
	mux.HandleFunc("POST /v1/attendance-snapshots/{chainId}/{vault}/{eventId}/{cutoff}", s.snapshot)
	return db.Close, nil
}

func problem(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
func respond(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, chain.ErrNotFound):
		problem(w, 404, "Event or participant not found onchain")
	case errors.Is(err, chain.ErrUnconfigured):
		problem(w, 409, "Event automation is not configured")
	default:
		problem(w, 503, "Required service is temporarily unavailable")
	}
}
func address(w http.ResponseWriter, value string) (common.Address, bool) {
	if len(value) != 42 || !strings.HasPrefix(value, "0x") || !common.IsHexAddress(value) || common.HexToAddress(value) == (common.Address{}) {
		problem(w, 400, "Invalid wallet or vault address")
		return common.Address{}, false
	}
	return common.HexToAddress(value), true
}
func (s *service) authenticated(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer cancel()
		user, err := s.privy.Authenticate(ctx, r.Header.Get("Authorization"))
		if errors.Is(err, auth.ErrUnauthorized) {
			problem(w, 401, "Valid Privy access token required")
			return
		}
		if err != nil {
			problem(w, 503, "Privy authentication is unavailable")
			return
		}
		if err = syncIdentity(ctx, s.db, user); err != nil {
			fail(w, err)
			return
		}
		if err = s.db.QueryRow(ctx, `SELECT display_name,profile_completed FROM app.users WHERE privy_id=$1`, user.ID).Scan(&user.Name, &user.ProfileCompleted); err != nil {
			fail(w, err)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, principalKey{}, user)))
	})
}
func principal(r *http.Request) auth.Principal {
	return r.Context().Value(principalKey{}).(auth.Principal)
}
func (s *service) me(w http.ResponseWriter, r *http.Request) { respond(w, principal(r)) }

func (s *service) ownedEvent(w http.ResponseWriter, r *http.Request) (chain.Event, bool) {
	vault, ok := address(w, r.PathValue("vault"))
	if !ok {
		return chain.Event{}, false
	}
	event, err := s.chain.Event(r.Context(), vault, false)
	if err != nil {
		fail(w, err)
		return chain.Event{}, false
	}
	if !principal(r).Owns(event.Owner) {
		problem(w, 403, "Current event owner wallet required")
		return chain.Event{}, false
	}
	return event, true
}

type metadata struct {
	OrganizerName string          `json:"organizerName,omitempty"`
	Title         string          `json:"title"`
	Description   string          `json:"description"`
	Location      string          `json:"location"`
	PosterURL     string          `json:"posterUrl"`
	Timezone      string          `json:"timezone"`
	Appearance    eventAppearance `json:"appearance"`
}

func (s *service) metadata(w http.ResponseWriter, r *http.Request) {
	vault, ok := address(w, r.PathValue("vault"))
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	var value metadata
	err := s.db.QueryRow(ctx, `SELECT e.title,e.description,e.location,e.poster_url,e.timezone,e.appearance,CASE WHEN u.profile_completed THEN u.display_name ELSE '' END
        FROM app.events e LEFT JOIN app.users u ON u.privy_id=e.updated_by
        WHERE e.chain_id=$1 AND e.vault=$2`, int64(s.chain.ChainID), strings.ToLower(vault.Hex())).Scan(&value.Title, &value.Description, &value.Location, &value.PosterURL, &value.Timezone, &value.Appearance, &value.OrganizerName)
	if err == pgx.ErrNoRows {
		problem(w, 404, "Event metadata not found")
		return
	}
	if err != nil {
		fail(w, err)
		return
	}
	respond(w, value)
}
func (s *service) saveMetadata(w http.ResponseWriter, r *http.Request) {
	event, ok := s.ownedEvent(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var value metadata
	if decoder.Decode(&value) != nil || decoder.Decode(new(any)) != io.EOF {
		problem(w, 400, "Invalid event metadata")
		return
	}
	value.Title = strings.TrimSpace(value.Title)
	value.OrganizerName = principal(r).Name
	if !normalizeAppearance(&value) {
		problem(w, 400, "Invalid event appearance or timezone")
		return
	}
	if value.Title == "" || utf8.RuneCountInString(value.Title) > 120 || utf8.RuneCountInString(value.Description) > 5000 || utf8.RuneCountInString(value.Location) > 300 || len(value.PosterURL) > 2048 {
		problem(w, 400, "Metadata exceeds allowed length")
		return
	}
	if value.PosterURL != "" {
		u, err := url.Parse(value.PosterURL)
		if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil {
			problem(w, 400, "Poster URL must use HTTPS")
			return
		}
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		fail(w, err)
		return
	}
	defer tx.Rollback(r.Context())
	if _, err = lockEvent(r.Context(), tx, event, s.chain.ChainID); err != nil {
		fail(w, err)
		return
	}
	_, err = tx.Exec(r.Context(), `UPDATE app.events SET title=$3,description=$4,location=$5,poster_url=$6,updated_by=$7,timezone=$8,appearance=$9,updated_at=clock_timestamp() WHERE chain_id=$1 AND vault=$2`, int64(s.chain.ChainID), strings.ToLower(event.Vault.Hex()), value.Title, value.Description, value.Location, value.PosterURL, principal(r).ID, value.Timezone, value.Appearance)
	if err != nil {
		fail(w, err)
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		fail(w, err)
		return
	}
	respond(w, value)
}

type checkInRecord struct {
	Wallet      string    `json:"wallet"`
	CheckedInAt time.Time `json:"checkedInAt"`
	RecordedBy  string    `json:"recordedBy"`
}

func (s *service) checkIns(w http.ResponseWriter, r *http.Request) {
	event, ok := s.ownedEvent(w, r)
	if !ok {
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT wallet,checked_in_at,recorded_by FROM app.check_ins WHERE chain_id=$1 AND vault=$2 ORDER BY wallet LIMIT 500`, int64(s.chain.ChainID), strings.ToLower(event.Vault.Hex()))
	if err != nil {
		fail(w, err)
		return
	}
	defer rows.Close()
	records := make([]checkInRecord, 0)
	for rows.Next() {
		var record checkInRecord
		if err = rows.Scan(&record.Wallet, &record.CheckedInAt, &record.RecordedBy); err != nil {
			fail(w, err)
			return
		}
		records = append(records, record)
	}
	if rows.Err() != nil {
		fail(w, rows.Err())
		return
	}
	respond(w, map[string]any{"checkIns": records})
}
func (s *service) checkIn(w http.ResponseWriter, r *http.Request) {
	event, ok := s.ownedEvent(w, r)
	if !ok {
		return
	}
	wallet, ok := address(w, r.PathValue("wallet"))
	if !ok {
		return
	}
	if !event.Configured {
		fail(w, chain.ErrUnconfigured)
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		fail(w, err)
		return
	}
	defer tx.Rollback(r.Context())
	frozen, err := lockEvent(r.Context(), tx, event, s.chain.ChainID)
	if err != nil {
		fail(w, err)
		return
	}
	var record checkInRecord
	err = tx.QueryRow(r.Context(), `SELECT wallet,checked_in_at,recorded_by FROM app.check_ins WHERE chain_id=$1 AND vault=$2 AND wallet=$3`, int64(s.chain.ChainID), strings.ToLower(event.Vault.Hex()), strings.ToLower(wallet.Hex())).Scan(&record.Wallet, &record.CheckedInAt, &record.RecordedBy)
	if err == nil {
		respond(w, record)
		return
	}
	if err != pgx.ErrNoRows {
		fail(w, err)
		return
	}
	if frozen != nil || !event.Started || event.Settled || event.Block.Time() >= event.Cutoff.Uint64() || time.Now().Unix() >= event.Cutoff.Int64() {
		problem(w, 409, "Check-in window is closed")
		return
	}
	confirmed, err := s.chain.Event(r.Context(), event.Vault, true)
	if err != nil {
		fail(w, err)
		return
	}
	if !confirmed.Started || confirmed.ID.Cmp(event.ID) != 0 {
		problem(w, 409, "Wait for the event start to finalize")
		return
	}
	if err = s.chain.Deposited(r.Context(), confirmed, []common.Address{wallet}); err != nil {
		fail(w, err)
		return
	}
	err = tx.QueryRow(r.Context(), `INSERT INTO app.check_ins(chain_id,vault,wallet,recorded_by,owner_wallet,observed_block,observed_block_hash)
        SELECT $1,$2,$3,$4,$5,$6,$7 WHERE extract(epoch FROM clock_timestamp()) < $8::numeric
        RETURNING wallet,checked_in_at,recorded_by`, int64(s.chain.ChainID), strings.ToLower(event.Vault.Hex()), strings.ToLower(wallet.Hex()), principal(r).ID, strings.ToLower(event.Owner.Hex()), int64(confirmed.Block.Height()), confirmed.Block.Hash, event.Cutoff.String()).Scan(&record.Wallet, &record.CheckedInAt, &record.RecordedBy)
	if err == pgx.ErrNoRows {
		problem(w, 409, "Check-in window is closed")
		return
	}
	if err != nil {
		fail(w, err)
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		fail(w, err)
		return
	}
	respond(w, record)
}
