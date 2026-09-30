package chain

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/EndPx/commitpass/packages/shared"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

var ErrNotFound = errors.New("unknown event vault")
var ErrUnavailable = errors.New("chain state unavailable")
var ErrUnconfigured = errors.New("event automation is not configured")

type Client struct {
	url                  string
	http                 *http.Client
	ChainID              uint64
	Factory              common.Address
	factoryABI, vaultABI abi.ABI
}

type Block struct {
	Number    string `json:"number"`
	Hash      string `json:"hash"`
	Timestamp string `json:"timestamp"`
}

func (b Block) Height() uint64 {
	n, _ := strconv.ParseUint(strings.TrimPrefix(b.Number, "0x"), 16, 64)
	return n
}
func (b Block) Time() uint64 {
	n, _ := strconv.ParseUint(strings.TrimPrefix(b.Timestamp, "0x"), 16, 64)
	return n
}

type Event struct {
	Vault, Owner                 common.Address
	ID, Cutoff                   *big.Int
	Started, Settled, Configured bool
	ParticipantCount             uint64
	Block                        Block
}

func New(endpoint string) (*Client, error) {
	u, err := url.Parse(endpoint)
	if err != nil || (u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "127.0.0.1" || u.Hostname() == "localhost"))) {
		return nil, fmt.Errorf("invalid Monad RPC URL")
	}
	deployment, err := shared.ActiveDeployment()
	if err != nil {
		return nil, err
	}
	c := &Client{url: endpoint, ChainID: deployment.ChainID, Factory: common.HexToAddress(deployment.Contracts["CommitPassFactory"].Address), http: &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
	if os.Getenv("COMMITPASS_LOCAL") == "1" {
		if u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost" {
			return nil, fmt.Errorf("local mode requires loopback RPC")
		}
		var version string
		if err := c.rpc(context.Background(), "web3_clientVersion", []any{}, &version); err != nil || !strings.Contains(strings.ToLower(version), "anvil") {
			return nil, fmt.Errorf("local mode requires Anvil")
		}
	}
	for name, target := range map[string]*abi.ABI{"CommitPassFactory": &c.factoryABI, "CommitPassVault": &c.vaultABI} {
		data, err := shared.ContractABI(name)
		if err != nil {
			return nil, err
		}
		parsed, err := abi.JSON(bytes.NewReader(data))
		if err != nil {
			return nil, err
		}
		*target = parsed
	}
	return c, nil
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
	Params  any    `json:"params"`
}
type rpcResponse struct {
	ID     int             `json:"id"`
	Result json.RawMessage `json:"result"`
	Error  json.RawMessage `json:"error"`
}

func (c *Client) request(ctx context.Context, payload any, result any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	response, err := c.http.Do(req)
	if err != nil {
		return ErrUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode != 200 || json.NewDecoder(io.LimitReader(response.Body, 2<<20)).Decode(result) != nil {
		return ErrUnavailable
	}
	return nil
}
func (c *Client) rpc(ctx context.Context, method string, params any, target any) error {
	var response rpcResponse
	if err := c.request(ctx, rpcRequest{"2.0", 1, method, params}, &response); err != nil {
		return err
	}
	if response.ID != 1 || (len(response.Error) > 0 && string(response.Error) != "null") || len(response.Result) == 0 || string(response.Result) == "null" {
		return ErrUnavailable
	}
	if json.Unmarshal(response.Result, target) != nil {
		return ErrUnavailable
	}
	return nil
}
func (c *Client) header(ctx context.Context, tag string) (Block, error) {
	var block Block
	err := c.rpc(ctx, "eth_getBlockByNumber", []any{tag, false}, &block)
	if err == nil && (len(block.Hash) != 66 || block.Number == "" || block.Timestamp == "") {
		err = ErrUnavailable
	}
	return block, err
}
func (c *Client) Confirm(ctx context.Context, block Block) error {
	current, err := c.header(ctx, block.Number)
	if err != nil {
		return err
	}
	if current.Hash != block.Hash {
		return ErrUnavailable
	}
	return nil
}

type call struct {
	Address common.Address
	ABI     *abi.ABI
	Method  string
	Args    []any
}

func (c *Client) calls(ctx context.Context, block Block, calls []call) ([][]any, error) {
	results := make([][]any, len(calls))
	for start := 0; start < len(calls); start += 50 {
		end := min(start+50, len(calls))
		requests := make([]rpcRequest, 0, end-start)
		for i := start; i < end; i++ {
			call := calls[i]
			data, err := call.ABI.Pack(call.Method, call.Args...)
			if err != nil {
				return nil, err
			}
			requests = append(requests, rpcRequest{"2.0", i + 1, "eth_call", []any{map[string]string{"to": call.Address.Hex(), "data": "0x" + hex.EncodeToString(data)}, block.Number}})
		}
		var responses []rpcResponse
		if err := c.request(ctx, requests, &responses); err != nil {
			return nil, err
		}
		if len(responses) != end-start {
			return nil, ErrUnavailable
		}
		seen := map[int]bool{}
		for _, r := range responses {
			i := r.ID - 1
			if i < start || i >= end || seen[i] || (len(r.Error) > 0 && string(r.Error) != "null") {
				return nil, ErrUnavailable
			}
			seen[i] = true
			var hexResult string
			if json.Unmarshal(r.Result, &hexResult) != nil || !strings.HasPrefix(hexResult, "0x") {
				return nil, ErrUnavailable
			}
			data, err := hex.DecodeString(hexResult[2:])
			if err != nil {
				return nil, ErrUnavailable
			}
			decoded, err := calls[i].ABI.Unpack(calls[i].Method, data)
			if err != nil {
				return nil, ErrUnavailable
			}
			results[i] = decoded
		}
	}
	return results, nil
}

func (c *Client) Event(ctx context.Context, vault common.Address, finalized bool) (Event, error) {
	var id string
	if err := c.rpc(ctx, "eth_chainId", []any{}, &id); err != nil {
		return Event{}, err
	}
	chainID, err := strconv.ParseUint(strings.TrimPrefix(id, "0x"), 16, 64)
	if err != nil || chainID != c.ChainID {
		return Event{}, ErrUnavailable
	}
	tag := "latest"
	if finalized {
		tag = "finalized"
	}
	block, err := c.header(ctx, tag)
	if err != nil {
		return Event{}, err
	}
	valid, err := c.calls(ctx, block, []call{{c.Factory, &c.factoryABI, "isVault", []any{vault}}})
	if err != nil {
		return Event{}, err
	}
	if !valid[0][0].(bool) {
		return Event{}, ErrNotFound
	}
	values, err := c.calls(ctx, block, []call{
		{vault, &c.vaultABI, "eventId", nil}, {vault, &c.vaultABI, "owner", nil}, {vault, &c.vaultABI, "depositedToYield", nil},
		{vault, &c.vaultABI, "eventSettled", nil}, {vault, &c.vaultABI, "getParticipantCount", nil}, {vault, &c.vaultABI, "factory", nil},
		{vault, &c.vaultABI, "getSchedule", nil},
	})
	if err != nil {
		return Event{}, err
	}
	configured := values[5][0].(common.Address) == c.Factory && values[6][0].(*big.Int).Sign() != 0
	cutoff := values[6][2].(*big.Int)
	if cutoff.Sign() == 0 {
		cutoff = values[6][1].(*big.Int)
	}
	count := values[4][0].(*big.Int)
	if !count.IsUint64() || count.Uint64() > 500 || !cutoff.IsInt64() {
		return Event{}, ErrUnavailable
	}
	if err := c.Confirm(ctx, block); err != nil {
		return Event{}, err
	}
	return Event{Vault: vault, Owner: values[1][0].(common.Address), ID: values[0][0].(*big.Int), Cutoff: cutoff, Started: values[2][0].(bool), Settled: values[3][0].(bool), Configured: configured, ParticipantCount: count.Uint64(), Block: block}, nil
}

func (c *Client) Deposited(ctx context.Context, event Event, wallets []common.Address) error {
	calls := make([]call, 0, len(wallets))
	for _, wallet := range wallets {
		calls = append(calls, call{event.Vault, &c.vaultABI, "participants", []any{wallet}})
	}
	results, err := c.calls(ctx, event.Block, calls)
	if err != nil {
		return err
	}
	for _, result := range results {
		if !result[0].(bool) {
			return ErrNotFound
		}
	}
	return c.Confirm(ctx, event.Block)
}

func SnapshotHash(chainID uint64, vault common.Address, eventID, cutoff *big.Int, attendees []common.Address) (string, error) {
	uintType, _ := abi.NewType("uint256", "", nil)
	addressType, _ := abi.NewType("address", "", nil)
	arrayType, _ := abi.NewType("address[]", "", nil)
	args := abi.Arguments{{Type: uintType}, {Type: addressType}, {Type: uintType}, {Type: uintType}, {Type: arrayType}}
	data, err := args.Pack(new(big.Int).SetUint64(chainID), vault, eventID, cutoff, attendees)
	if err != nil {
		return "", err
	}
	return crypto.Keccak256Hash(data).Hex(), nil
}
