// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {MockAUSD, MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {CommitPassFactory} from "../src/CommitPassFactory.sol";
import {CommitPassAutomation} from "../src/CommitPassAutomation.sol";

contract DeployTestnet is Script {
    function run() external {
        require(block.chainid == 10143, "Monad testnet only");
        address forwarder = vm.envAddress("CRE_FORWARDER");
        address treasury = vm.envAddress("TREASURY");
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        require(deployer != address(0), "Invalid deployer");
        // Foundry resolves this sender through --account/--password-file.
        vm.startBroadcast(deployer);
        MockAUSD asset = new MockAUSD();
        MockYieldVault yieldVault = new MockYieldVault(asset);
        CommitPassFactory factory = new CommitPassFactory(address(yieldVault), treasury);
        CommitPassAutomation automation = new CommitPassAutomation(forwarder, address(factory));
        vm.stopBroadcast();
        console.log("Mock AUSD", address(asset));
        console.log("Mock yield vault", address(yieldVault));
        console.log("Factory", address(factory));
        console.log("CRE receiver", address(automation));
        // Register the workflow with this receiver address, then configureWorkflow(actualWorkflowId).
    }
}
