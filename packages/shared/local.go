package shared

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
)

// Local runs have isolated namespaces; public schemas are never reset.
func LocalSchemas() (app, indexer string, err error) {
	if os.Getenv("COMMITPASS_LOCAL") != "1" {
		if schema := os.Getenv("COMMITPASS_INDEXER_SCHEMA"); schema != "" {
			if schema != "envio_hosted" && schema != "envio_usdc" && schema != "envio_usdc_simulation" && schema != "envio_usdc_vault" {
				return "", "", fmt.Errorf("invalid hosted indexer namespace")
			}
			return "app", schema, nil
		}
		return "app", "envio", nil
	}
	run := os.Getenv("COMMITPASS_LOCAL_RUN")
	if !regexp.MustCompile(`^[a-z0-9]{12,32}$`).MatchString(run) {
		return "", "", fmt.Errorf("invalid local run namespace")
	}
	return "app_local_" + run, "envio_local_" + run, nil
}

func ActiveDeployment() (Deployment, error) {
	if os.Getenv("COMMITPASS_LOCAL") != "1" {
		return MonadTestnetDeployment()
	}
	var result Deployment
	data, err := os.ReadFile(os.Getenv("COMMITPASS_LOCAL_MANIFEST"))
	if err != nil {
		return result, fmt.Errorf("local deployment manifest unavailable")
	}
	if err = json.Unmarshal(data, &result); err != nil {
		return result, err
	}
	if result.ChainID != 10143 {
		return result, fmt.Errorf("unexpected local simulation chain ID")
	}
	for _, name := range []string{"CommitPassFactory", "USDC"} {
		if !regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`).MatchString(result.Contracts[name].Address) {
			return result, fmt.Errorf("invalid local contract address")
		}
	}
	return result, nil
}
