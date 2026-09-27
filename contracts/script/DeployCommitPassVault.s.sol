// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {CommitPassVault} from "../src/CommitPassVault.sol";

contract DeployCommitPassVault is Script {
    CommitPassVault public commitPassVault;

    function run() external returns (address) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);
        console.log("Deployer:", msg.sender);

        uint256 stakeAmount = 1 * 10**6; // 1 asset unit for a token with 6 decimals
        uint256 registrationDeadline = block.timestamp + 1 days;
        uint256 eventDate = block.timestamp + 2 days;

        commitPassVault = new CommitPassVault(
            1, // eventId
            vm.envAddress("ORGANIZER"),
            stakeAmount,
            registrationDeadline,
            eventDate,
            10, // maxParticipant
            vm.envAddress("YIELD_VAULT"),
            vm.envAddress("TREASURY")
        );
        console.log("CommitPassVault deployed at:", address(commitPassVault));

        vm.stopBroadcast();

        return address(commitPassVault);
    }
}