// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IEventFactory {
    function notifyLifecycleRequested(uint8 action) external;
}
