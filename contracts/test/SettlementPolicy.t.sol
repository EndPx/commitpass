// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {CommitPassVault} from "../src/CommitPassVault.sol";
import {CommitPassFactory} from "../src/CommitPassFactory.sol";
import {CommitPassAutomation} from "../src/CommitPassAutomation.sol";
import {MockAUSD, MockYieldVault} from "../src/mocks/MockYieldVault.sol";

contract SettlementPolicyTest is Test {
    MockAUSD internal asset;
    MockYieldVault internal yieldVault;
    CommitPassVault internal vault;
    address internal treasury = address(0xBEEF);
    address internal alice = address(0x101);
    address internal bob = address(0x102);
    address internal carol = address(0x103);

    function setUp() public {
        asset = new MockAUSD();
        yieldVault = new MockYieldVault(asset);
        vault = new CommitPassVault(1, address(this), 10e6, block.timestamp + 1 hours, block.timestamp + 2 hours, 3, address(yieldVault), treasury);
        asset.faucet();
        _fund(alice);
        _fund(bob);
        _fund(carol);
    }

    function _fund(address guest) internal {
        vm.startPrank(guest);
        asset.faucet();
        asset.approve(address(vault), 10e6);
        vm.stopPrank();
    }

    function _deposit(address guest) internal {
        vm.prank(guest);
        vault.deposit();
    }

    function testNormalSettlementSplitsNoShowAndConservesFunds() public {
        _deposit(alice);
        _deposit(bob);
        _deposit(carol);
        vault.depositToYieldSource();
        asset.transfer(address(yieldVault), 2e6);
        address[] memory attendees = new address[](2);
        attendees[0] = alice;
        attendees[1] = bob;
        vault.settleEvent(attendees);
        assertEq(vault.settlementOutcome(), 1);
        assertEq(vault.protocolRevenue(), 5e6);
        assertEq(vault.totalYieldEarned(), 1_999_999);
        assertEq(vault.totalAllocated(), 26_999_999);
        assertEq(asset.balanceOf(treasury), 5e6);
        assertEq(vault.getUserReward(alice), 13_500_000);
        assertEq(vault.getUserReward(bob), 13_499_999);
        assertEq(vault.getUserReward(carol), 0);
        vm.prank(carol);
        vm.expectRevert("No reward available");
        vault.claimReward();
        vm.prank(bob);
        vault.claimReward();
        vm.prank(alice);
        vault.claimReward();
        assertEq(vault.totalClaimed(), vault.totalAllocated());
        assertEq(asset.balanceOf(address(vault)), 0);
    }

    function testZeroAttendanceRefundsAllAndChargesNoFee() public {
        _deposit(alice);
        _deposit(bob);
        vault.depositToYieldSource();
        asset.transfer(address(yieldVault), 2e6);
        vault.settleEvent(new address[](0));
        assertEq(vault.settlementOutcome(), 2);
        assertEq(vault.protocolRevenue(), 0);
        assertEq(vault.totalAllocated(), 21_999_999);
        assertEq(vault.getUserReward(alice), 11e6);
        assertEq(vault.getUserReward(bob), 10_999_999);
        vm.prank(bob);
        vault.claimReward();
        vm.prank(alice);
        vault.claimReward();
        assertEq(asset.balanceOf(address(vault)), 0);
        assertEq(asset.balanceOf(treasury), 0);
    }

    function testOwnerCancelBeforeStartEnablesExactRefunds() public {
        _deposit(alice);
        _deposit(bob);
        vault.cancelEvent();
        assertEq(vault.settlementOutcome(), 3);
        assertEq(vault.totalAllocated(), 20e6);
        assertEq(vault.protocolRevenue(), 0);
        vm.expectRevert("Registration closed");
        vault.deposit();
        vm.expectRevert("Event not startable");
        vault.depositToYieldSource();
        vm.prank(alice);
        vault.claimReward();
        vm.prank(bob);
        vault.claimReward();
        assertEq(asset.balanceOf(address(vault)), 0);
        assertEq(asset.balanceOf(treasury), 0);
        vm.expectRevert("Event not cancellable");
        vault.cancelEvent();
    }

    function testCancellationRejectsNonOwnerAndLateCall() public {
        _deposit(alice);
        vm.prank(alice);
        vm.expectRevert();
        vault.cancelEvent();
        vm.warp(vault.eventDate());
        vm.expectRevert("Event start time passed");
        vault.cancelEvent();
    }

    function testStartRequestBlocksCancellation() public {
        CommitPassFactory factory = new CommitPassFactory(address(yieldVault), treasury);
        CommitPassAutomation automation = new CommitPassAutomation(address(asset), address(factory));
        automation.configureWorkflow(bytes32(uint256(1)));
        factory.createAutomatedEvent(10e6, block.timestamp + 1 hours, block.timestamp + 2 hours, 3, address(automation), block.timestamp + 3 hours);
        CommitPassVault automated = CommitPassVault(factory.vaultByEventId(1));
        vm.startPrank(alice);
        asset.approve(address(automated), 10e6);
        automated.deposit();
        vm.stopPrank();
        automation.requestStart(address(automated));
        vm.expectRevert("Start already requested");
        automated.cancelEvent();
    }

    function testOddRawUnitRemainderIsDeterministic() public {
        // Odd no-show principal leaves one raw unit on the guest side.
        vault = new CommitPassVault(2, address(this), 3_000_001, block.timestamp + 1 hours, block.timestamp + 2 hours, 3, address(yieldVault), treasury);
        for (uint256 i; i < 3; i++) {
            address guest = i == 0 ? alice : i == 1 ? bob : carol;
            vm.startPrank(guest);
            asset.approve(address(vault), 3_000_001);
            vault.deposit();
            vm.stopPrank();
        }
        vault.depositToYieldSource();
        address[] memory attendees = new address[](2);
        attendees[0] = alice;
        attendees[1] = bob;
        vault.settleEvent(attendees);
        assertEq(vault.protocolRevenue(), 1_500_000);
        assertEq(vault.getUserReward(alice), 3_750_002);
        assertEq(vault.getUserReward(bob), 3_750_001);
        assertEq(vault.totalAllocated() + vault.protocolRevenue(), 9_000_003);
    }
}
