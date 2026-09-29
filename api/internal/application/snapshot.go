package application

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"math/big"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/EndPx/commitpass/api/internal/chain"
	"github.com/EndPx/commitpass/packages/shared"
	"github.com/ethereum/go-ethereum/common"
	"github.com/jackc/pgx/v5"
)

var canonicalUint = regexp.MustCompile(`^(0|[1-9][0-9]*)$`)

func uint256(value string) (*big.Int, bool) {
	if !canonicalUint.MatchString(value) {
		return nil, false
	}
	n, ok := new(big.Int).SetString(value, 10)
	return n, ok && n.BitLen() <= 256
}

// POST freezes once; GET only reads an existing immutable snapshot.
func (s *service) snapshot(w http.ResponseWriter, r *http.Request) {
	authorization := r.Header.Get("Authorization")
	if !strings.HasPrefix(authorization, "Bearer ") {
		problem(w, 401, "CRE credential required")
		return
	}
	hash := sha256.Sum256([]byte(strings.TrimPrefix(authorization, "Bearer ")))
	if subtle.ConstantTimeCompare(hash[:], s.snapshotSecret[:]) != 1 {
		problem(w, 401, "CRE credential required")
		return
	}
	if r.PathValue("chainId") != strconv.FormatUint(s.chain.ChainID, 10) {
		problem(w, 400, "Wrong chain")
		return
	}
	vault, ok := address(w, r.PathValue("vault"))
	if !ok {
		return
	}
	eventID, ok := uint256(r.PathValue("eventId"))
	if !ok {
		problem(w, 400, "Invalid event ID")
		return
	}
	cutoff, ok := uint256(r.PathValue("cutoff"))
	if !ok {
		problem(w, 400, "Invalid cutoff")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	event, err := s.chain.Event(ctx, vault, true)
	if err != nil {
		fail(w, err)
		return
	}
	if !event.Configured {
		fail(w, chain.ErrUnconfigured)
		return
	}
	if event.ID.Cmp(eventID) != 0 || event.Cutoff.Cmp(cutoff) != 0 {
		problem(w, 409, "Snapshot domain does not match the contract")
		return
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		fail(w, err)
		return
	}
	defer tx.Rollback(ctx)
	frozen, err := lockEvent(ctx, tx, event, s.chain.ChainID)
	if err != nil {
		fail(w, err)
		return
	}
	var payload json.RawMessage
	var storedID, storedCutoff, anchorHash string
	var anchor int64
	err = tx.QueryRow(ctx, `SELECT payload,event_number::text,cutoff::text,anchor_block,anchor_block_hash FROM app.attendance_snapshots WHERE chain_id=$1 AND vault=$2`, int64(s.chain.ChainID), strings.ToLower(vault.Hex())).Scan(&payload, &storedID, &storedCutoff, &anchor, &anchorHash)
	if err == nil {
		if storedID != eventID.String() || storedCutoff != cutoff.String() {
			problem(w, 409, "A different snapshot is already frozen")
			return
		}
		if err = s.chain.Confirm(ctx, chain.Block{Number: "0x" + strconv.FormatInt(anchor, 16), Hash: anchorHash}); err != nil {
			fail(w, err)
			return
		}
		respond(w, payload)
		return
	}
	if err != pgx.ErrNoRows {
		fail(w, err)
		return
	}
	if frozen != nil {
		problem(w, 409, "Frozen attendance record is inconsistent")
		return
	}
	if r.Method == http.MethodGet {
		problem(w, 404, "Snapshot has not been frozen")
		return
	}
	if !event.Started || event.Settled || event.Block.Time() < cutoff.Uint64() {
		problem(w, 409, "Settlement cutoff is not finalized or event is not active")
		return
	}
	rows, err := tx.Query(ctx, `SELECT wallet FROM app.check_ins WHERE chain_id=$1 AND vault=$2 AND extract(epoch FROM checked_in_at)<$3::numeric ORDER BY wallet COLLATE "C"`, int64(s.chain.ChainID), strings.ToLower(vault.Hex()), cutoff.String())
	if err != nil {
		fail(w, err)
		return
	}
	attendees := make([]common.Address, 0)
	for rows.Next() {
		var wallet string
		if err = rows.Scan(&wallet); err != nil {
			rows.Close()
			fail(w, err)
			return
		}
		attendees = append(attendees, common.HexToAddress(wallet))
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		fail(w, err)
		return
	}
	if len(attendees) > 500 || uint64(len(attendees)) > event.ParticipantCount {
		problem(w, 409, "Attendance exceeds onchain participant count")
		return
	}
	if err = s.chain.Deposited(ctx, event, attendees); err != nil {
		fail(w, err)
		return
	}
	digest, err := chain.SnapshotHash(s.chain.ChainID, vault, eventID, cutoff, attendees)
	if err != nil {
		fail(w, err)
		return
	}
	snapshot := shared.AttendanceSnapshot{Version: 1, ChainID: strconv.FormatUint(s.chain.ChainID, 10), Vault: vault.Hex(), EventID: eventID.String(), Cutoff: cutoff.String(), Frozen: true, Attendees: make([]string, 0, len(attendees)), Hash: digest}
	for _, wallet := range attendees {
		snapshot.Attendees = append(snapshot.Attendees, wallet.Hex())
	}
	payload, err = json.Marshal(snapshot)
	if err != nil {
		fail(w, err)
		return
	}
	_, err = tx.Exec(ctx, `INSERT INTO app.attendance_snapshots(chain_id,vault,event_number,cutoff,payload,snapshot_hash,anchor_block,anchor_block_hash)
        VALUES($1,$2,$3::numeric,$4::numeric,$5::jsonb,$6,$7,$8)`, int64(s.chain.ChainID), strings.ToLower(vault.Hex()), eventID.String(), cutoff.String(), string(payload), digest, int64(event.Block.Height()), event.Block.Hash)
	if err != nil {
		fail(w, err)
		return
	}
	if _, err = tx.Exec(ctx, `UPDATE app.events SET frozen_cutoff=$3::numeric WHERE chain_id=$1 AND vault=$2`, int64(s.chain.ChainID), strings.ToLower(vault.Hex()), cutoff.String()); err != nil {
		fail(w, err)
		return
	}
	if err = tx.Commit(ctx); err != nil {
		fail(w, err)
		return
	}
	respond(w, payload)
}
