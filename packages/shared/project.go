// Package shared exposes language-neutral project data to Go consumers.
package shared

import (
	_ "embed"
	"encoding/json"
)

//go:embed src/project.json
var projectJSON []byte

type ProjectMetadata struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Tagline     string `json:"tagline"`
}

func Project() (ProjectMetadata, error) {
	var project ProjectMetadata
	err := json.Unmarshal(projectJSON, &project)
	return project, err
}
