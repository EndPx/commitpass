package shared

import (
	"embed"
	"encoding/json"
)

//go:embed abi/*.json src/deployments/monad-testnet.json
var contracts embed.FS

func ContractABI(name string) ([]byte, error) { return contracts.ReadFile("abi/" + name + ".json") }

type Deployment struct {
	ChainID   uint64 `json:"chainId"`
	Contracts map[string]struct {
		Address string `json:"address"`
	} `json:"contracts"`
}

func MonadTestnetDeployment() (Deployment, error) {
	var deployment Deployment
	data, err := contracts.ReadFile("src/deployments/monad-testnet.json")
	if err != nil {
		return deployment, err
	}
	err = json.Unmarshal(data, &deployment)
	return deployment, err
}
