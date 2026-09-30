// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {CommitPassFactory} from "../src/CommitPassFactory.sol";

/// @notice Creates an event through the canonical factory; never a standalone vault.
contract DeployCommitPassVault is Script {
    function run() external returns (address vault) {
        require(block.chainid == 10143, "Monad testnet only");
        CommitPassFactory factory = CommitPassFactory(vm.envAddress("FACTORY_ADDRESS"));
        require(address(factory).code.length > 0 && factory.isConfigured(), "Factory not configured");
        uint256 id = factory.eventIdCounter();
        vm.startBroadcast(vm.envAddress("ORGANIZER"));
        factory.createEvent(
            vm.envUint("STAKE_AMOUNT"),
            vm.envUint("REGISTRATION_DEADLINE"),
            vm.envUint("EVENT_DATE"),
            vm.envUint("MAX_PARTICIPANTS"),
            vm.envUint("SETTLE_AT")
        );
        vm.stopBroadcast();
        vault = factory.vaultByEventId(id);
        console.log("Event vault / CRE receiver", vault);
    }
}
