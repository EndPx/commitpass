package application

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

type privateVaultEnvelope struct {
	Vault json.RawMessage `json:"vault"`
}

func (s *service) privateKit(w http.ResponseWriter, r *http.Request) {
	event, ok := s.ownedEvent(w, r)
	if !ok {
		return
	}
	vault := strings.ToLower(event.Vault.Hex())
	if r.Method == http.MethodGet {
		var value json.RawMessage
		err := s.db.QueryRow(r.Context(), `SELECT private_vault FROM app.events WHERE chain_id=$1 AND vault=$2`, int64(s.chain.ChainID), vault).Scan(&value)
		if err == pgx.ErrNoRows || len(value) == 0 || string(value) == "null" {
			problem(w, 404, "Private event kit not found")
			return
		}
		if err != nil {
			fail(w, err)
			return
		}
		respond(w, map[string]any{"vault": json.RawMessage(value)})
		return
	}
	if r.Method != http.MethodPut {
		problem(w, 405, "Method not allowed")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	var envelope privateVaultEnvelope
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if decoder.Decode(&envelope) != nil || decoder.Decode(new(any)) != io.EOF || len(envelope.Vault) == 0 || string(envelope.Vault) == "null" || !json.Valid(envelope.Vault) {
		problem(w, 400, "Invalid private vault")
		return
	}
	var object struct {
		Version    int            `json:"version"`
		Credential meraCredential `json:"credential"`
		PRFSalt    string         `json:"prfSalt"`
		Nonce      string         `json:"nonce"`
		Ciphertext string         `json:"ciphertext"`
	}
	decoded := json.NewDecoder(strings.NewReader(string(envelope.Vault)))
	decoded.DisallowUnknownFields()
	if decoded.Decode(&object) != nil || decoded.Decode(new(any)) != io.EOF || object.Version != 1 || !validMeraCredential(object.Credential) || !canonicalBase64URL(object.PRFSalt, 32, 32) || !canonicalBase64URL(object.Nonce, 12, 12) || !canonicalBase64URL(object.Ciphertext, 16, 0) {
		problem(w, 400, "Invalid Mera private vault format")
		return
	}
	var linked json.RawMessage
	if err := s.db.QueryRow(r.Context(), `SELECT mera_credential FROM app.users WHERE privy_id=$1`, principal(r).ID).Scan(&linked); err != nil {
		fail(w, err)
		return
	}
	var credential meraCredential
	if json.Unmarshal(linked, &credential) != nil || credential.CredentialID != object.Credential.CredentialID {
		problem(w, 409, "Link this Mera passkey to your account first")
		return
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
	if _, err = tx.Exec(r.Context(), `UPDATE app.events SET private_vault=$3,updated_by=$4,updated_at=clock_timestamp() WHERE chain_id=$1 AND vault=$2`, int64(s.chain.ChainID), vault, envelope.Vault, principal(r).ID); err != nil {
		fail(w, err)
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		fail(w, err)
		return
	}
	respond(w, map[string]any{"saved": true})
}
