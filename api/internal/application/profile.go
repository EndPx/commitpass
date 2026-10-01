package application

import (
	"encoding/json"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"
)

func (s *service) saveProfile(w http.ResponseWriter, r *http.Request) {
	var value struct {
		Name string `json:"name"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&value) != nil {
		problem(w, 400, "Invalid profile")
		return
	}
	value.Name = strings.TrimSpace(value.Name)
	length := utf8.RuneCountInString(value.Name)
	if !utf8.ValidString(value.Name) || length < 2 || length > 60 || strings.ContainsFunc(value.Name, unicode.IsControl) {
		problem(w, 400, "Your name must contain 2 to 60 characters without control characters")
		return
	}
	user := principal(r)
	if err := s.db.QueryRow(r.Context(), `UPDATE app.users SET display_name=$2,profile_completed=true WHERE privy_id=$1 RETURNING display_name,profile_completed`, user.ID, value.Name).Scan(&user.Name, &user.ProfileCompleted); err != nil {
		fail(w, err)
		return
	}
	respond(w, user)
}
