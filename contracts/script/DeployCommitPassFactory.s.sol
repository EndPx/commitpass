// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {CommitPassFactory} from "../src/CommitPassFactory.sol";

contract DeployCommitPassFactory is Script {
    CommitPassFactory public commitPassFactory;

    function run() external returns (address) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        console.log("Deploying CommitPassFactory...");

        vm.startBroadcast(privateKey);
        commitPassFactory = new CommitPassFactory();
        vm.stopBroadcast();

        console.log("CommitPassFactory deployed at:", address(commitPassFactory));

        return address(commitPassFactory);
    }
}