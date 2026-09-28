package application

import (
	"regexp"
	"time"
	_ "time/tzdata"
)

type eventAppearance struct {
	Style string `json:"style"`
	Color string `json:"color"`
	Font  string `json:"font"`
	Mode  string `json:"mode"`
}

var themeColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func normalizeAppearance(value *metadata) bool {
	if value.Timezone == "" {
		value.Timezone = "UTC"
	}
	if len(value.Timezone) > 100 {
		return false
	}
	if _, err := time.LoadLocation(value.Timezone); err != nil {
		return false
	}
	if value.Appearance.Style == "" {
		value.Appearance.Style = "minimal"
	}
	if value.Appearance.Color == "" {
		value.Appearance.Color = "#b9462d"
	}
	if value.Appearance.Font == "" {
		value.Appearance.Font = "sans"
	}
	if value.Appearance.Mode == "" {
		value.Appearance.Mode = "light"
	}
	appearance := value.Appearance
	validStyle := appearance.Style == "minimal" || appearance.Style == "aurora" || appearance.Style == "confetti" || appearance.Style == "grid"
	validFont := appearance.Font == "sans" || appearance.Font == "serif" || appearance.Font == "mono"
	return validStyle && validFont && themeColor.MatchString(appearance.Color) && (appearance.Mode == "light" || appearance.Mode == "dark")
}
