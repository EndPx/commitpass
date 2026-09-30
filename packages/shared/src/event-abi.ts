// Generated from the compiled shared ABI snapshots by scripts/export-web-abi.mjs.
export const factoryAbi = [
  {
    type: "function",
    name: "createAutomatedEvent",
    inputs: [
      {
        name: "stakeAmount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "registrationDeadline",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "eventDate",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "maxParticipant",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "automation",
        type: "address",
        internalType: "address",
      },
      {
        name: "settleAt",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "eventId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isVault",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "VaultCreated",
    inputs: [
      {
        name: "eventId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "vault",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "organizer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "stakeAmount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "maxParticipant",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "registrationDeadline",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "eventDate",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
] as const;
export const eventVaultAbi = [
  {
    type: "function",
    name: "USDC_TOKEN",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IERC20",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "automation",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "cancelEvent",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimReward",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "depositedToYield",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "eventDate",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "eventSettled",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getParticipantCount",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxParticipant",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "participants",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "hasDeposited",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "hasAttended",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "hasClaimed",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "claimableRewards",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "protocolRevenue",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registrationClosed",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registrationDeadline",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "settlementOutcome",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint8",
        internalType: "uint8",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "stakeAmount",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalAllocated",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalClaimed",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
] as const;
export const eventAutomationAbi = [
  {
    type: "function",
    name: "getState",
    inputs: [
      {
        name: "vault",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "eventId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "action",
        type: "uint8",
        internalType: "uint8",
      },
      {
        name: "cutoff",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "requestSettlement",
    inputs: [
      {
        name: "vault",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requestStart",
    inputs: [
      {
        name: "vault",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "schedules",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "startAt",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "settleAt",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "requestedCutoff",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "startRequested",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "settledSnapshot",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "workflowId",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
] as const;
