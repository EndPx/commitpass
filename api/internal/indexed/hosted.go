package indexed

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"time"
)

// Envio Cloud stores chain entities and exposes them through its GraphQL API.
// Application metadata, check-ins and snapshots stay in the application database.
type hostedReader struct {
	endpoint string
	client   *http.Client
}
type entity map[string]any

const eventFields = `id chainId vault eventId organizer owner stakeAmount maxParticipant registrationDeadline startAt settleAt automation status registrationClosed participantCount attendeeCount claimCount totalCommitted yieldDeposited totalYield protocolFee rewardPerAttendee totalClaimed snapshotHash createdAt updatedAt lastBlock lastTransaction`
const participantFields = `id event_id wallet amount attended claimed claimedAmount allocatedAmount depositedAt depositTransaction claimTransaction`
const activityFields = `id event_id kind chainId contract blockNumber blockHash timestamp transactionHash logIndex wallet amount snapshotHash`

func registerHosted(mux *http.ServeMux, endpoint string) (func(), error) {
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil || parsed.Fragment != "" {
		return nil, errors.New("invalid ENVIO_GRAPHQL_URL")
	}
	s := &hostedReader{endpoint: endpoint, client: &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
	mux.HandleFunc("GET /v1/events", s.events)
	mux.HandleFunc("GET /v1/events/{vault}", s.event)
	mux.HandleFunc("GET /v1/events/{vault}/participants", s.participants)
	mux.HandleFunc("GET /v1/events/{vault}/activity", s.activity)
	mux.HandleFunc("GET /v1/wallet-profile", s.walletProfile)
	mux.HandleFunc("GET /v1/wallet-positions", s.walletPositions)
	return s.client.CloseIdleConnections, nil
}

func (s *hostedReader) rows(ctx context.Context, table, fields string, where entity, limit int, descending bool) ([]entity, error) {
	order := "asc"
	if descending {
		order = "desc"
	}
	query := fmt.Sprintf(`query($where:%s_bool_exp!,$limit:Int!){%s(where:$where,limit:$limit,order_by:{id:%s}){%s}}`, table, table, order, fields)
	payload, err := json.Marshal(entity{"query": query, "variables": entity{"where": where, "limit": limit}})
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := s.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, errors.New("hosted indexer unavailable")
	}
	var reply struct {
		Data   map[string][]entity `json:"data"`
		Errors []json.RawMessage   `json:"errors"`
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, 4<<20))
	decoder.UseNumber()
	if err = decoder.Decode(&reply); err != nil || len(reply.Errors) > 0 || reply.Data[table] == nil {
		return nil, errors.New("invalid hosted indexer response")
	}
	for _, row := range reply.Data[table] {
		if err := normalizeIntegers(row, table); err != nil {
			return nil, err
		}
	}
	return reply.Data[table], nil
}

func decimal(value any) (string, error) {
	var text string
	switch value := value.(type) {
	case string:
		text = value
	case json.Number:
		text = value.String()
	default:
		return "", errors.New("missing indexed integer")
	}
	if text == "" || (len(text) > 1 && text[0] == '0') {
		return "", errors.New("invalid indexed integer")
	}
	for _, digit := range text {
		if digit < '0' || digit > '9' {
			return "", errors.New("invalid indexed integer")
		}
	}
	return text, nil
}

func normalizeIntegers(row entity, table string) error {
	names := map[string][]string{
		"CommitmentEvent": {"eventId", "stakeAmount", "maxParticipant", "registrationDeadline", "startAt", "settleAt", "totalCommitted", "yieldDeposited", "totalYield", "protocolFee", "rewardPerAttendee", "totalClaimed", "createdAt", "updatedAt", "lastBlock"},
		"Participant":     {"amount", "claimedAmount", "allocatedAmount", "depositedAt"},
		"ChainActivity":   {"blockNumber", "timestamp", "amount"},
	}
	for _, name := range names[table] {
		if row[name] == nil && (name == "settleAt" || name == "allocatedAmount" || name == "amount" && table == "ChainActivity") {
			continue
		}
		value, err := decimal(row[name])
		if err != nil {
			return err
		}
		row[name] = value
	}
	if id, ok := row["id"].(string); !ok || id == "" {
		return errors.New("missing indexed ID")
	}
	return nil
}

func hostedList(w http.ResponseWriter, data []entity) {
	var next *string
	if len(data) > 100 {
		data = data[:100]
		id := data[len(data)-1]["id"].(string)
		next = &id
	}
	respond(w, entity{"source": "envio", "provider": "cloud", "chainId": 10143, "data": data, "nextCursor": next})
}

func (s *hostedReader) findEvent(ctx context.Context, id string) (entity, error) {
	rows, err := s.rows(ctx, "CommitmentEvent", eventFields, entity{"chainId": entity{"_eq": 10143}, "id": entity{"_eq": id}}, 1, false)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return rows[0], nil
}

func (s *hostedReader) event(w http.ResponseWriter, r *http.Request) {
	id, ok := key(w, r)
	if !ok {
		return
	}
	data, err := s.findEvent(r.Context(), id)
	if err != nil {
		unavailable(w, r)
		return
	}
	if data == nil {
		http.Error(w, "Event not indexed", http.StatusNotFound)
		return
	}
	respond(w, entity{"source": "envio", "provider": "cloud", "chainId": 10143, "data": data})
}

func (s *hostedReader) walletParticipants(ctx context.Context, wallets []string) ([]entity, error) {
	result := make([]entity, 0)
	after := ""
	for {
		rows, err := s.rows(ctx, "Participant", participantFields, entity{"wallet": entity{"_in": wallets}, "event_id": entity{"_like": "10143_%"}, "id": entity{"_gt": after}}, 1000, false)
		if err != nil {
			return nil, err
		}
		result = append(result, rows...)
		// Fail rather than return partial profile totals for an excessively large response.
		if len(result) > 10_000 {
			return nil, errors.New("profile pagination limit exceeded")
		}
		if len(rows) < 1000 {
			return result, nil
		}
		next := rows[len(rows)-1]["id"].(string)
		if next <= after {
			return nil, errors.New("indexer cursor did not advance")
		}
		after = next
	}
}

func (s *hostedReader) events(w http.ResponseWriter, r *http.Request) {
	where := entity{"chainId": entity{"_eq": 10143}, "id": entity{"_gt": r.URL.Query().Get("after")}}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if r.URL.Query().Get("wallets") != "" {
		wallets, ok := profileWallets(w, r)
		if !ok {
			return
		}
		hosting := entity{"owner": entity{"_in": wallets}}
		role := r.URL.Query().Get("role")
		if role == "hosting" {
			where["owner"] = hosting["owner"]
		} else {
			if role != "" && role != "all" && role != "going" {
				http.Error(w, "Invalid event role", 400)
				return
			}
			positions, err := s.walletParticipants(ctx, wallets)
			if err != nil {
				unavailable(w, r)
				return
			}
			ids := make([]string, 0, len(positions))
			for _, p := range positions {
				id, ok := p["event_id"].(string)
				if !ok {
					unavailable(w, r)
					return
				}
				ids = append(ids, id)
			}
			going := entity{"id": entity{"_in": ids}}
			if role == "going" {
				where["_and"] = []entity{going}
			} else {
				where["_or"] = []entity{hosting, going}
			}
		}
	}
	data, err := s.rows(ctx, "CommitmentEvent", eventFields, where, 101, false)
	if err != nil {
		unavailable(w, r)
		return
	}
	hostedList(w, data)
}

func claimable(participant, event entity) (string, error) {
	claimed, ok := participant["claimed"].(bool)
	if !ok {
		return "", errors.New("invalid claim flag")
	}
	if claimed {
		return "0", nil
	}
	status := event["status"]
	if status != "SETTLED" && status != "REFUNDED" && status != "CANCELLED" {
		return "0", nil
	}
	if allocated := participant["allocatedAmount"]; allocated != nil {
		return decimal(allocated)
	}
	if status == "SETTLED" && participant["attended"] == true {
		return decimal(event["rewardPerAttendee"])
	}
	return "0", nil
}

func (s *hostedReader) participants(w http.ResponseWriter, r *http.Request) {
	id, ok := key(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	event, err := s.findEvent(ctx, id)
	if err != nil {
		unavailable(w, r)
		return
	}
	if event == nil {
		hostedList(w, []entity{})
		return
	}
	data, err := s.rows(ctx, "Participant", participantFields, entity{"event_id": entity{"_eq": id}, "id": entity{"_gt": r.URL.Query().Get("after")}}, 101, false)
	if err != nil {
		unavailable(w, r)
		return
	}
	for _, p := range data {
		value, err := claimable(p, event)
		if err != nil {
			unavailable(w, r)
			return
		}
		p["claimableAmount"] = value
	}
	hostedList(w, data)
}

func (s *hostedReader) activity(w http.ResponseWriter, r *http.Request) {
	id, ok := key(w, r)
	if !ok {
		return
	}
	data, err := s.rows(r.Context(), "ChainActivity", activityFields, entity{"chainId": entity{"_eq": 10143}, "event_id": entity{"_eq": id}, "id": entity{"_gt": r.URL.Query().Get("after")}}, 101, false)
	if err != nil {
		unavailable(w, r)
		return
	}
	hostedList(w, data)
}

func (s *hostedReader) positionEvents(ctx context.Context, positions []entity) (map[string]entity, error) {
	ids := make([]string, 0)
	seen := map[string]bool{}
	for _, p := range positions {
		id, ok := p["event_id"].(string)
		if !ok {
			return nil, errors.New("missing event relation")
		}
		if !seen[id] {
			ids = append(ids, id)
			seen[id] = true
		}
	}
	result := map[string]entity{}
	for start := 0; start < len(ids); start += 1000 {
		rows, err := s.rows(ctx, "CommitmentEvent", eventFields, entity{"chainId": entity{"_eq": 10143}, "id": entity{"_in": ids[start:min(start+1000, len(ids))]}}, 1000, false)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			result[row["id"].(string)] = row
		}
	}
	if len(result) != len(ids) {
		return nil, errors.New("incomplete event relations")
	}
	return result, nil
}

func (s *hostedReader) walletPositions(w http.ResponseWriter, r *http.Request) {
	wallets, ok := profileWallets(w, r)
	if !ok {
		return
	}
	after := r.URL.Query().Get("after")
	if len(after) > 180 {
		http.Error(w, "Invalid cursor", 400)
		return
	}
	kind := r.URL.Query().Get("kind")
	if kind != "" && kind != "all" && kind != "claimable" && kind != "received" {
		http.Error(w, "Invalid position filter", 400)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	positions, err := s.walletParticipants(ctx, wallets)
	if err != nil {
		unavailable(w, r)
		return
	}
	events, err := s.positionEvents(ctx, positions)
	if err != nil {
		unavailable(w, r)
		return
	}
	data := make([]entity, 0, 101)
	for i := len(positions) - 1; i >= 0 && len(data) < 101; i-- {
		p := positions[i]
		if after != "" && p["id"].(string) >= after {
			continue
		}
		event := events[p["event_id"].(string)]
		value, err := claimable(p, event)
		if err != nil {
			unavailable(w, r)
			return
		}
		if kind == "claimable" && value == "0" || kind == "received" && p["claimed"] != true {
			continue
		}
		p["claimableAmount"] = value
		p["event"] = event
		data = append(data, p)
	}
	hostedList(w, data)
}

func (s *hostedReader) walletProfile(w http.ResponseWriter, r *http.Request) {
	wallets, ok := profileWallets(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	positions, err := s.walletParticipants(ctx, wallets)
	if err != nil {
		unavailable(w, r)
		return
	}
	events, err := s.positionEvents(ctx, positions)
	if err != nil {
		unavailable(w, r)
		return
	}
	totals := map[string]*big.Int{"committedAmount": new(big.Int), "claimableAmount": new(big.Int), "receivedAmount": new(big.Int)}
	registrations := map[string]int64{}
	settled := map[string]bool{}
	attended := map[string]bool{}
	for _, p := range positions {
		id := p["event_id"].(string)
		event := events[id]
		value, err := claimable(p, event)
		if err != nil {
			unavailable(w, r)
			return
		}
		add := func(name string, raw any) bool {
			text, err := decimal(raw)
			if err != nil {
				return false
			}
			n, ok := new(big.Int).SetString(text, 10)
			if !ok {
				return false
			}
			totals[name].Add(totals[name], n)
			return true
		}
		if !add("claimableAmount", value) {
			unavailable(w, r)
			return
		}
		if p["claimed"] == true && !add("receivedAmount", p["claimedAmount"]) {
			unavailable(w, r)
			return
		}
		if event["status"] != "SETTLED" && event["status"] != "REFUNDED" && event["status"] != "CANCELLED" && !add("committedAmount", p["amount"]) {
			unavailable(w, r)
			return
		}
		if event["status"] == "SETTLED" {
			settled[id] = true
			if p["attended"] == true {
				attended[id] = true
			}
		}
		timestamp, ok := new(big.Int).SetString(p["depositedAt"].(string), 10)
		if !ok || !timestamp.IsInt64() {
			unavailable(w, r)
			return
		}
		if prior, exists := registrations[id]; !exists || timestamp.Int64() < prior {
			registrations[id] = timestamp.Int64()
		}
	}
	now := time.Now().UTC()
	firstMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -5, 0)
	months := make([]entity, 0, 6)
	for month := firstMonth; !month.After(now); month = month.AddDate(0, 1, 0) {
		count := 0
		for _, timestamp := range registrations {
			if time.Unix(timestamp, 0).UTC().Format("2006-01") == month.Format("2006-01") {
				count++
			}
		}
		if count > 0 {
			months = append(months, entity{"month": month.Format("2006-01"), "events": count})
		}
	}
	// Hosted count is fetched independently; hosted-only events need not have guests.
	hosted, err := s.countHosted(ctx, wallets)
	if err != nil {
		unavailable(w, r)
		return
	}
	data := entity{"eventsJoined": len(events), "eventsHosted": hosted, "settledEvents": len(settled), "eventsAttended": len(attended), "months": months}
	for name, total := range totals {
		data[name] = total.String()
	}
	respond(w, entity{"source": "envio", "provider": "cloud", "chainId": 10143, "data": data})
}

func (s *hostedReader) countHosted(ctx context.Context, wallets []string) (int, error) {
	count := 0
	after := ""
	for {
		rows, err := s.rows(ctx, "CommitmentEvent", eventFields, entity{"chainId": entity{"_eq": 10143}, "owner": entity{"_in": wallets}, "id": entity{"_gt": after}}, 1000, false)
		if err != nil {
			return 0, err
		}
		count += len(rows)
		if count > 10_000 {
			return 0, errors.New("hosted event pagination limit exceeded")
		}
		if len(rows) < 1000 {
			return count, nil
		}
		next := rows[len(rows)-1]["id"].(string)
		if next <= after {
			return 0, errors.New("indexer cursor did not advance")
		}
		after = next
	}
}
