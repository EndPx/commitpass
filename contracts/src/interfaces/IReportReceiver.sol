// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IReportReceiver {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}
