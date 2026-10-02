package application

import (
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Only the organizer can resolve chosen public names for their guest list.
func (s *service) guestProfiles(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.ownedEvent(w, r); !ok {
		return
	}
	wallets := strings.Split(strings.ToLower(r.URL.Query().Get("wallets")), ",")
	if len(wallets) > 100 {
		problem(w, 400, "Too many guest wallets")
		return
	}
	for _, wallet := range wallets {
		if _, ok := address(w, wallet); !ok {
			return
		}
	}
	rows, err := s.db.Query(r.Context(), `SELECT DISTINCT ON (l.wallet) l.wallet,u.display_name
        FROM app.wallet_links l JOIN app.users u ON u.privy_id=l.privy_id
        WHERE l.wallet=ANY($1::text[]) AND l.active AND u.profile_completed
        ORDER BY l.wallet,l.verified_at DESC,u.privy_id`, wallets)
	if err != nil {
		fail(w, err)
		return
	}
	defer rows.Close()
	names := map[string]string{}
	for rows.Next() {
		var wallet, name string
		if err := rows.Scan(&wallet, &name); err != nil {
			fail(w, err)
			return
		}
		names[wallet] = name
	}
	if rows.Err() != nil {
		fail(w, rows.Err())
		return
	}
	respond(w, map[string]any{"names": names})
}

// Attendance is private to its wallet owner; current Privy links authorize reads.
func (s *service) ownAttendance(w http.ResponseWriter, r *http.Request) {
	vault, ok := address(w, r.PathValue("vault"))
	if !ok {
		return
	}
	wallet, ok := address(w, r.PathValue("wallet"))
	if !ok {
		return
	}
	if !principal(r).Owns(wallet) {
		problem(w, 403, "Current participant wallet required")
		return
	}
	var checkedAt time.Time
	err := s.db.QueryRow(r.Context(), `SELECT checked_in_at FROM app.check_ins WHERE chain_id=$1 AND vault=$2 AND wallet=$3`, int64(s.chain.ChainID), strings.ToLower(vault.Hex()), strings.ToLower(wallet.Hex())).Scan(&checkedAt)
	if err == pgx.ErrNoRows {
		respond(w, map[string]any{"checkedIn": false, "checkedInAt": nil})
		return
	}
	if err != nil {
		fail(w, err)
		return
	}
	respond(w, map[string]any{"checkedIn": true, "checkedInAt": checkedAt})
}
