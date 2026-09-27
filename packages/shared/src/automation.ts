/** Wire formats shared by the attendance API and the CRE workflow. All times are Unix seconds. */
export const AUTOMATION_ACTION = { start: 1, settle: 2 } as const;
export const MONAD_TESTNET = {
  chainId: 10143,
  selectorName: "monad-testnet",
} as const;

export interface AttendanceSnapshot {
  version: 1;
  chainId: string;
  vault: `0x${string}`;
  eventId: string;
  cutoff: string;
  frozen: true;
  attendees: `0x${string}`[];
  snapshotHash: `0x${string}`;
}

export const snapshotParameters = [
  { type: "uint256", name: "chainId" },
  { type: "address", name: "vault" },
  { type: "uint256", name: "eventId" },
  { type: "uint256", name: "cutoff" },
  { type: "address[]", name: "attendees" },
] as const;

export const reportParameters = [
  { type: "uint256", name: "chainId" },
  { type: "address", name: "vault" },
  { type: "uint8", name: "action" },
  { type: "uint256", name: "validUntil" },
  { type: "uint256", name: "cutoff" },
  { type: "bytes32", name: "snapshotHash" },
  { type: "address[]", name: "attendees" },
] as const;
