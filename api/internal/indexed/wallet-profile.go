package indexed

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

// These endpoints contain public chain facts only. The web profile derives its
// wallet filter from authenticated /v1/me, never from a client-supplied address.
func profileWallets(w http.ResponseWriter, r *http.Request) ([]string, bool) {
	wallets := strings.Split(strings.ToLower(r.URL.Query().Get("wallets")), ",")
	if len(wallets) > 20 {
		http.Error(w, "Too many wallet filters", http.StatusBadRequest)
		return nil, false
	}
	for _, wallet := range wallets {
		if !walletAddress.MatchString(wallet) {
			http.Error(w, "Invalid wallet filter", http.StatusBadRequest)
			return nil, false
		}
	}
	return wallets, true
}

const profileClaim = `CASE WHEN p.claimed OR e.status NOT IN ('SETTLED','REFUNDED','CANCELLED') THEN 0
    WHEN to_jsonb(p)->>'allocatedAmount' IS NOT NULL THEN (to_jsonb(p)->>'allocatedAmount')::numeric
    WHEN e.status='SETTLED' AND p.attended THEN e."rewardPerAttendee" ELSE 0 END`

func (s *reader) walletProfile(w http.ResponseWriter, r *http.Request) {
	wallets, ok := profileWallets(w, r)
	if !ok {
		return
	}
	query := `WITH positions AS (
        SELECT p.*, e.status, ` + profileClaim + ` AS available
        FROM envio."Participant" p JOIN envio."CommitmentEvent" e ON e.id=p.event_id
        WHERE e."chainId"=10143 AND lower(p.wallet)=ANY($1::text[])
    ), registrations AS (
        SELECT event_id, min("depositedAt") AS deposited FROM positions GROUP BY event_id
    ), months AS (
        SELECT to_char(to_timestamp(deposited::double precision) AT TIME ZONE 'UTC','YYYY-MM') AS month, count(*) AS events
        FROM registrations WHERE deposited >= EXTRACT(EPOCH FROM (date_trunc('month',now() AT TIME ZONE 'UTC') - INTERVAL '5 months'))
        GROUP BY month
    ) SELECT jsonb_build_object(
        'eventsJoined', count(DISTINCT event_id),
        'eventsHosted', (SELECT count(*) FROM envio."CommitmentEvent" WHERE "chainId"=10143 AND lower(owner)=ANY($1::text[])),
        'settledEvents', count(DISTINCT event_id) FILTER (WHERE status='SETTLED'),
        'eventsAttended', count(DISTINCT event_id) FILTER (WHERE status='SETTLED' AND attended),
        'committedAmount', COALESCE(sum(amount) FILTER (WHERE status NOT IN ('SETTLED','REFUNDED','CANCELLED')),0)::text,
        'claimableAmount', COALESCE(sum(available),0)::text,
        'receivedAmount', COALESCE(sum("claimedAmount") FILTER (WHERE claimed),0)::text,
        'months', COALESCE((SELECT jsonb_agg(jsonb_build_object('month',month,'events',events) ORDER BY month) FROM months),'[]'::jsonb)
    ) FROM positions`
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	var data json.RawMessage
	if err := s.pool.QueryRow(ctx, strings.ReplaceAll(query, "envio.", s.schema+"."), wallets).Scan(&data); err != nil {
		unavailable(w, r)
		return
	}
	respond(w, map[string]any{"source": "envio", "chainId": 10143, "data": data})
}

func (s *reader) walletPositions(w http.ResponseWriter, r *http.Request) {
	wallets, ok := profileWallets(w, r)
	if !ok {
		return
	}
	after := r.URL.Query().Get("after")
	if len(after) > 180 {
		http.Error(w, "Invalid cursor", http.StatusBadRequest)
		return
	}
	filter := ""
	switch r.URL.Query().Get("kind") {
	case "", "all":
	case "claimable":
		filter = ` AND (` + profileClaim + `) > 0`
	case "received":
		filter = ` AND p.claimed`
	default:
		http.Error(w, "Invalid position filter", http.StatusBadRequest)
		return
	}
	s.list(w, r, `SELECT jsonb_build_object(
        'id',p.id,'wallet',p.wallet,'amount',p.amount::text,
        'attended',p.attended,'claimed',p.claimed,'claimedAmount',p."claimedAmount"::text,
        'claimableAmount',(`+profileClaim+`)::text,
        'event',`+eventJSON+`)
        FROM envio."Participant" p JOIN envio."CommitmentEvent" e ON e.id=p.event_id
        WHERE e."chainId"=10143 AND lower(p.wallet)=ANY($1::text[])
        AND ($2::text='' OR p.id<$2)`+filter+` ORDER BY p.id DESC LIMIT 101`, wallets, after)
}
