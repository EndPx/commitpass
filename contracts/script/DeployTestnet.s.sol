// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {MockYieldVault, IERC20} from "../src/mocks/MockYieldVault.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {CommitPassFactory} from "../src/CommitPassFactory.sol";
import {CommitPassAutomation} from "../src/CommitPassAutomation.sol";

contract DeployTestnet is Script {
    address public constant USDC = 0x534b2f3A21130d7a60830c2Df862319e593943A3;
    function run() external {
        require(block.chainid == 10143, "Monad testnet only");
        require(USDC.code.length > 0 && IERC20Metadata(USDC).decimals() == 6, "Invalid Monad USDC");
        address forwarder = vm.envAddress("CRE_FORWARDER");
        address treasury = vm.envAddress("TREASURY");
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        require(deployer != address(0), "Invalid deployer");
        // Foundry resolves this sender through --account/--password-file.
        vm.startBroadcast(deployer);
        MockYieldVault yieldVault = new MockYieldVault(IERC20(USDC));
        CommitPassFactory factory = new CommitPassFactory(address(yieldVault), treasury);
        CommitPassAutomation automation = new CommitPassAutomation(forwarder, address(factory));
        vm.stopBroadcast();
        console.log("USDC", USDC);
        console.log("Mock yield vault", address(yieldVault));
        console.log("Factory", address(factory));
        console.log("CRE receiver", address(automation));
        // Register the workflow with this receiver address, then configureWorkflow(actualWorkflowId).
    }
}
