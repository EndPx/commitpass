// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
import {Script, console} from "forge-std/Script.sol";
import {CommitPassSimulationAutomation} from "../src/CommitPassSimulationAutomation.sol";

contract DeploySimulationAutomation is Script {
    function run() external {
        require(block.chainid == 10143, "Monad testnet only");
        address forwarder = vm.envAddress("CRE_SIMULATION_FORWARDER");
        address factory = vm.envAddress("COMMITPASS_FACTORY");
        address signer = vm.envAddress("SIMULATION_REPORT_SIGNER");
        vm.startBroadcast(vm.envAddress("DEPLOYER_ADDRESS"));
        CommitPassSimulationAutomation receiver = new CommitPassSimulationAutomation(forwarder, factory, signer);
        vm.stopBroadcast();
        console.log("Simulation receiver", address(receiver));
    }
}
