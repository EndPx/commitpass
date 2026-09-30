#!/usr/bin/env bash
# Verify the exact constructor of a factory-created vault on Monad testnet.
# Foundry consumes ETHERSCAN_API_KEY from its environment; never print credentials.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."
vault=${1:?Usage: bash script/verify-vault.sh 0xVault}
[[ "$vault" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo 'Invalid vault address'; exit 1; }
rpc=https://testnet-rpc.monad.xyz
[[ $(cast chain-id --rpc-url "$rpc") == 10143 ]] || exit 1
read_field() { cast call "$vault" "$1" --rpc-url "$rpc" | awk '{print $1}'; }
args=$(cast abi-encode 'constructor(uint256,address,uint256,uint256,uint256,uint256,address,address,uint256,address,bytes32,address)' \
  "$(read_field 'eventId()(uint256)')" \
  "$(read_field 'organizer()(address)')" \
  "$(read_field 'stakeAmount()(uint256)')" \
  "$(read_field 'registrationDeadline()(uint256)')" \
  "$(read_field 'eventDate()(uint256)')" \
  "$(read_field 'maxParticipant()(uint256)')" \
  "$(read_field 'yieldVault()(address)')" \
  "$(read_field 'treasury()(address)')" \
  "$(read_field 'settleAt()(uint256)')" \
  "$(read_field 'getForwarderAddress()(address)')" \
  "$(read_field 'getExpectedWorkflowId()(bytes32)')" \
  "$(read_field 'simulationReportSigner()(address)')")
forge verify-contract "$vault" src/CommitPassVault.sol:CommitPassVault \
  --chain 10143 --verifier etherscan --watch --constructor-args "$args"
