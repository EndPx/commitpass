package application

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"

	"github.com/jackc/pgx/v5"
)

type meraCredential struct {
	CredentialID string   `json:"credentialId"`
	Transports   []string `json:"transports,omitempty"`
}

func canonicalBase64URL(value string, minimum, exact int) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	return err == nil && len(decoded) >= minimum && (exact == 0 || len(decoded) == exact) && base64.RawURLEncoding.EncodeToString(decoded) == value
}

func validMeraCredential(value meraCredential) bool {
	if len(value.CredentialID) > 1024 || !canonicalBase64URL(value.CredentialID, 1, 0) || len(value.Transports) > 8 {
		return false
	}
	for _, transport := range value.Transports {
		if len(transport) == 0 || len(transport) > 32 {
			return false
		}
	}
	return true
}

func (s *service) meraCredential(w http.ResponseWriter, r *http.Request) {
	id := principal(r).ID
	if r.Method == http.MethodGet {
		var saved json.RawMessage
		err := s.db.QueryRow(r.Context(), `SELECT mera_credential FROM app.users WHERE privy_id=$1`, id).Scan(&saved)
		if err != nil {
			fail(w, err)
			return
		}
		respond(w, map[string]any{"credential": json.RawMessage(saved)})
		return
	}
	if r.Method != http.MethodPut {
		problem(w, 405, "Method not allowed")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	var envelope struct {
		Credential meraCredential `json:"credential"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if decoder.Decode(&envelope) != nil || decoder.Decode(new(any)) != io.EOF || !validMeraCredential(envelope.Credential) {
		problem(w, 400, "Invalid Mera credential metadata")
		return
	}
	value, _ := json.Marshal(envelope.Credential)
	var stored json.RawMessage
	err := s.db.QueryRow(r.Context(), `UPDATE app.users SET mera_credential=$2 WHERE privy_id=$1 AND mera_credential IS NULL RETURNING mera_credential`, id, value).Scan(&stored)
	if err == pgx.ErrNoRows {
		err = s.db.QueryRow(r.Context(), `SELECT mera_credential FROM app.users WHERE privy_id=$1`, id).Scan(&stored)
	}
	if err != nil {
		fail(w, err)
		return
	}
	var current meraCredential
	if json.Unmarshal(stored, &current) != nil || current.CredentialID != envelope.Credential.CredentialID {
		problem(w, 409, "A different Mera passkey is already linked to this account")
		return
	}
	respond(w, map[string]any{"credential": current})
}
