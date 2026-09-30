// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IReportReceiver} from "../interfaces/IReportReceiver.sol";

/// @notice CRE receiver pattern from Chainlink's consumer-contract guide.
/// Permissions are immutable: event owners cannot change the forwarder or workflow.
/// This abstract base is included in each vault, never deployed separately.
abstract contract ReceiverTemplate is IReportReceiver, IERC165 {
    address private immutable trustedForwarder;
    bytes32 private immutable expectedWorkflowId;
    address public immutable simulationReportSigner;
    bytes32 private immutable domainSeparator;
    bytes32 private constant REPORT_TYPEHASH = keccak256("SimulationReport(bytes payload)");

    constructor(address forwarder, bytes32 workflowId, address signer) {
        require(forwarder.code.length > 0, "Invalid forwarder");
        if (signer != address(0)) {
            require(
                block.chainid == 10143 && signer.code.length == 0 && workflowId == bytes32(0),
                "Invalid simulation configuration"
            );
        } else {
            require(workflowId != bytes32(0), "Workflow identity required");
        }
        trustedForwarder = forwarder;
        expectedWorkflowId = workflowId;
        simulationReportSigner = signer;
        domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("CommitPass CRE simulation"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    function getForwarderAddress() public view returns (address) {
        return trustedForwarder;
    }

    function getExpectedWorkflowId() external view returns (bytes32) {
        return expectedWorkflowId;
    }

    function isConfigured() public view returns (bool) {
        return expectedWorkflowId != bytes32(0) || simulationReportSigner != address(0);
    }

    function onReport(bytes calldata metadata, bytes calldata report) external override {
        require(msg.sender == trustedForwarder, "Forwarder only");
        bytes memory payload;
        if (simulationReportSigner != address(0)) {
            require(block.chainid == 10143, "Monad testnet only");
            bytes memory signature;
            (payload, signature) = abi.decode(report, (bytes, bytes));
            bytes32 digest = keccak256(
                abi.encodePacked(
                    "\x19\x01", domainSeparator, keccak256(abi.encode(REPORT_TYPEHASH, keccak256(payload)))
                )
            );
            require(ECDSA.recover(digest, signature) == simulationReportSigner, "Invalid simulation signature");
        } else {
            require(metadata.length == 64 && bytes32(metadata[:32]) == expectedWorkflowId, "Invalid workflow metadata");
            payload = report;
        }
        _processReport(payload);
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReportReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function _processReport(bytes memory report) internal virtual;
}
