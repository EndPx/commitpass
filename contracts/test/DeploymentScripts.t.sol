// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {DeployCommitPassFactory} from "../script/DeployCommitPassFactory.s.sol";
import {DeployCommitPassVault} from "../script/DeployCommitPassVault.s.sol";
import {CommitPassFactory} from "../src/CommitPassFactory.sol";
import {CommitPassVault} from "../src/CommitPassVault.sol";
import {MockUSDC, MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {LocalCREForwarder} from "./fixtures/LocalCREForwarder.sol";

contract DeploymentScriptsTest is Test {
    address internal deployer = address(0xDE01);
    address internal organizer = address(0xA101);
    address internal treasury = address(0xBEEF);
    address internal forwarder;
    MockYieldVault internal yieldVault;
    bytes32 internal workflowId;

    function setUp() public {
        vm.chainId(10143);
        vm.deal(deployer, 100 ether);
        vm.deal(organizer, 100 ether);
        MockUSDC usdc = new MockUSDC();
        yieldVault = new MockYieldVault(usdc);
        LocalCREForwarder fixture = new LocalCREForwarder(deployer);
        forwarder = address(fixture);
        workflowId = fixture.WORKFLOW_ID();
        vm.setEnv("DEPLOYER_ADDRESS", vm.toString(deployer));
        vm.setEnv("YIELD_VAULT", vm.toString(address(yieldVault)));
        vm.setEnv("TREASURY", vm.toString(treasury));
        vm.setEnv("CRE_FORWARDER", vm.toString(forwarder));
        vm.setEnv("CRE_WORKFLOW_ID", vm.toString(workflowId));
        vm.setEnv("SIMULATION_REPORT_SIGNER", vm.toString(address(0)));
    }

    function testFactoryAndVaultDeploymentScripts() public {
        address deployed = new DeployCommitPassFactory().run();
        CommitPassFactory factory = CommitPassFactory(deployed);
        assertEq(factory.forwarder(), forwarder);
        assertEq(factory.workflowId(), workflowId);
        assertEq(factory.yieldVault(), address(yieldVault));
        vm.setEnv("FACTORY_ADDRESS", vm.toString(deployed));
        vm.setEnv("ORGANIZER", vm.toString(organizer));
        vm.setEnv("STAKE_AMOUNT", "100000");
        vm.setEnv("REGISTRATION_DEADLINE", vm.toString(block.timestamp + 1 hours));
        vm.setEnv("EVENT_DATE", vm.toString(block.timestamp + 2 hours));
        vm.setEnv("MAX_PARTICIPANTS", "2");
        vm.setEnv("SETTLE_AT", vm.toString(block.timestamp + 3 hours));
        CommitPassVault vault = CommitPassVault(new DeployCommitPassVault().run());
        assertTrue(factory.isVault(address(vault)));
        assertEq(vault.factory(), deployed);
        assertEq(vault.owner(), organizer);
        assertEq(vault.organizer(), organizer);
        assertEq(vault.getForwarderAddress(), forwarder);
        assertEq(vault.settleAt(), block.timestamp + 3 hours);
    }

    function testDeploymentScriptRejectsOtherChains() public {
        vm.chainId(1);
        DeployCommitPassFactory script = new DeployCommitPassFactory();
        vm.expectRevert("Monad testnet only");
        script.run();
    }
}
