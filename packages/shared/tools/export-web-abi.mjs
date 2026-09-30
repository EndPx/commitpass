import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../../../", import.meta.url);
const contracts = [
  [
    "CommitPassFactory",
    "factoryAbi",
    ["createAutomatedEvent", "VaultCreated", "isVault"],
  ],
  [
    "CommitPassVault",
    "eventVaultAbi",
    [
      "deposit",
      "claimReward",
      "participants",
      "stakeAmount",
      "registrationDeadline",
      "maxParticipant",
      "getParticipantCount",
      "registrationClosed",
      "depositedToYield",
      "eventSettled",
      "USDC_TOKEN",
      "owner",
      "automation",
      "eventDate",
      "cancelEvent",
      "settlementOutcome",
      "protocolRevenue",
      "totalAllocated",
      "totalClaimed",
    ],
  ],
  [
    "CommitPassAutomation",
    "eventAutomationAbi",
    [
      "workflowId",
      "isConfigured",
      "requestStart",
      "requestSettlement",
      "schedules",
      "getState",
    ],
  ],
];
let source =
  "// Generated from the compiled shared ABI snapshots by packages/shared/tools/export-web-abi.mjs.\n";
for (const [name, variable, names] of contracts) {
  const abi = JSON.parse(
    await readFile(new URL(`packages/shared/abi/${name}.json`, root), "utf8"),
  );
  source += `export const ${variable} = ${JSON.stringify(
    abi.filter((item) => names.includes(item.name)),
    null,
    2,
  )} as const;\n`;
}
await writeFile(new URL("packages/shared/src/event-abi.ts", root), source);
