package application

import (
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

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
