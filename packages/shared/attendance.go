package shared

// AttendanceSnapshot is the version-1 wire format consumed by the CRE workflow.
// Numeric domain fields are decimal strings; addresses use EIP-55 formatting.
type AttendanceSnapshot struct {
	Version   int      `json:"version"`
	ChainID   string   `json:"chainId"`
	Vault     string   `json:"vault"`
	EventID   string   `json:"eventId"`
	Cutoff    string   `json:"cutoff"`
	Frozen    bool     `json:"frozen"`
	Attendees []string `json:"attendees"`
	Hash      string   `json:"snapshotHash"`
}
