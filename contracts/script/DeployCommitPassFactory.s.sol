// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {CommitPassFactory} from "../src/CommitPassFactory.sol";

contract DeployCommitPassFactory is Script {
    CommitPassFactory public commitPassFactory;

    function run() external returns (address) {
        require(block.chainid == 10143, "Monad testnet only");
        console.log("Deploying CommitPassFactory...");

        vm.startBroadcast(vm.envAddress("DEPLOYER_ADDRESS"));
        commitPassFactory = new CommitPassFactory(
            vm.envAddress("YIELD_VAULT"),
            vm.envAddress("TREASURY"),
            vm.envAddress("CRE_FORWARDER"),
            vm.envOr("CRE_WORKFLOW_ID", bytes32(0)),
            vm.envOr("SIMULATION_REPORT_SIGNER", address(0))
        );
        vm.stopBroadcast();

        console.log("CommitPassFactory deployed at:", address(commitPassFactory));

        return address(commitPassFactory);
    }
}
