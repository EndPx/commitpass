package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/ethereum/go-ethereum/common"
	"github.com/golang-jwt/jwt/v5"
)

var ErrUnauthorized = errors.New("invalid Privy authentication")
var ErrUnavailable = errors.New("Privy is unavailable")
var appIDPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

type Principal struct {
	ID      string   `json:"id"`
	Wallets []string `json:"wallets"`
	Name    string   `json:"name,omitempty"`
}

type accessClaims struct {
	jwt.RegisteredClaims
	SessionID      string          `json:"sid"`
	LinkedAccounts json.RawMessage `json:"linked_accounts"`
}

func (p Principal) Owns(address common.Address) bool {
	for _, wallet := range p.Wallets {
		if strings.EqualFold(wallet, address.Hex()) {
			return true
		}
	}
	return false
}

type Privy struct {
	appID, secret      string
	http               *http.Client
	mu                 sync.Mutex
	keys               map[string]*ecdsa.PublicKey
	fetched, attempted time.Time
}

func NewPrivy(appID, secret string) (*Privy, error) {
	if !appIDPattern.MatchString(appID) || secret == "" {
		return nil, fmt.Errorf("Privy app ID and secret are required")
	}
	return &Privy{appID: appID, secret: secret, http: &http.Client{
		Timeout:       8 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}}, nil
}

// Authenticate validates the access JWT and obtains current wallet links from Privy.
// Wallet addresses supplied in request bodies never establish account ownership.
func (p *Privy) Authenticate(ctx context.Context, authorization string) (Principal, error) {
	if !strings.HasPrefix(authorization, "Bearer ") {
		return Principal{}, ErrUnauthorized
	}
	raw := strings.TrimPrefix(authorization, "Bearer ")
	if len(raw) > 8192 || strings.ContainsAny(raw, " \r\n\t") {
		return Principal{}, ErrUnauthorized
	}
	var claims accessClaims
	token, err := jwt.ParseWithClaims(raw, &claims, func(token *jwt.Token) (any, error) {
		kid, ok := token.Header["kid"].(string)
		if !ok || kid == "" || len(kid) > 256 {
			return nil, ErrUnauthorized
		}
		return p.key(ctx, kid)
	}, jwt.WithValidMethods([]string{"ES256"}), jwt.WithIssuer("privy.io"),
		jwt.WithAudience(p.appID), jwt.WithExpirationRequired(), jwt.WithIssuedAt(), jwt.WithLeeway(15*time.Second))
	if errors.Is(err, ErrUnavailable) {
		return Principal{}, ErrUnavailable
	}
	if err != nil || !token.Valid || claims.IssuedAt == nil || claims.SessionID == "" || len(claims.SessionID) > 256 || len(claims.LinkedAccounts) > 0 || !strings.HasPrefix(claims.Subject, "did:privy:") || len(claims.Subject) <= len("did:privy:") || len(claims.Subject) > 255 {
		return Principal{}, ErrUnauthorized
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.privy.io/v1/users/"+url.PathEscape(claims.Subject), nil)
	req.SetBasicAuth(p.appID, p.secret)
	req.Header.Set("privy-app-id", p.appID)
	response, err := p.http.Do(req)
	if err != nil {
		return Principal{}, ErrUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return Principal{}, ErrUnauthorized
	}
	if response.StatusCode != http.StatusOK {
		return Principal{}, ErrUnavailable
	}
	var user struct {
		ID     string `json:"id"`
		Linked []struct {
			Type    string `json:"type"`
			Chain   string `json:"chain_type"`
			Address string `json:"address"`
			Name    string `json:"name"`
		} `json:"linked_accounts"`
	}
	if json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&user) != nil || user.ID != claims.Subject {
		return Principal{}, ErrUnavailable
	}
	wallets := make([]string, 0)
	seen := map[string]bool{}
	name := ""
	for _, account := range user.Linked {
		if account.Type == "google_oauth" {
			candidate := strings.TrimSpace(account.Name)
			if candidate != "" && utf8.RuneCountInString(candidate) <= 120 {
				name = candidate
			}
		}
		if account.Type != "wallet" || account.Chain != "ethereum" || !common.IsHexAddress(account.Address) {
			continue
		}
		wallet := strings.ToLower(common.HexToAddress(account.Address).Hex())
		if wallet != (common.Address{}).Hex() && !seen[wallet] {
			wallets = append(wallets, wallet)
			seen[wallet] = true
		}
	}
	sort.Strings(wallets)
	return Principal{ID: user.ID, Wallets: wallets, Name: name}, nil
}

func (p *Privy) key(ctx context.Context, kid string) (*ecdsa.PublicKey, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if key := p.keys[kid]; key != nil && time.Since(p.fetched) < time.Hour {
		return key, nil
	}
	if time.Since(p.attempted) < 30*time.Second {
		if p.keys == nil || time.Since(p.fetched) >= time.Hour {
			return nil, ErrUnavailable
		}
		return nil, ErrUnauthorized
	}
	p.attempted = time.Now()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://auth.privy.io/api/v1/apps/"+p.appID+"/jwks.json", nil)
	response, err := p.http.Do(req)
	if err != nil {
		return nil, ErrUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, ErrUnavailable
	}
	var jwks struct {
		Keys []struct {
			KID string `json:"kid"`
			KTY string `json:"kty"`
			CRV string `json:"crv"`
			ALG string `json:"alg"`
			Use string `json:"use"`
			X   string `json:"x"`
			Y   string `json:"y"`
		} `json:"keys"`
	}
	if json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&jwks) != nil {
		return nil, ErrUnavailable
	}
	keys := map[string]*ecdsa.PublicKey{}
	for _, key := range jwks.Keys {
		if key.KTY != "EC" || key.CRV != "P-256" || (key.ALG != "" && key.ALG != "ES256") || (key.Use != "" && key.Use != "sig") || key.KID == "" {
			continue
		}
		x, ex := base64.RawURLEncoding.DecodeString(key.X)
		y, ey := base64.RawURLEncoding.DecodeString(key.Y)
		if ex != nil || ey != nil || len(x) != 32 || len(y) != 32 {
			continue
		}
		point := &ecdsa.PublicKey{Curve: elliptic.P256(), X: new(big.Int).SetBytes(x), Y: new(big.Int).SetBytes(y)}
		if !point.Curve.IsOnCurve(point.X, point.Y) {
			continue
		}
		keys[key.KID] = point
	}
	if len(keys) == 0 {
		return nil, ErrUnavailable
	}
	p.keys, p.fetched = keys, time.Now()
	if key := keys[kid]; key != nil {
		return key, nil
	}
	return nil, ErrUnauthorized
}
