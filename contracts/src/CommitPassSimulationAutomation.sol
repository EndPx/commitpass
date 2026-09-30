// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {CommitPassAutomation} from "./CommitPassAutomation.sol";

/// @notice Monad testnet CRE CLI receiver. Operator signatures are not DON attestations.
/// The public MockForwarder carries no workflow identity, so each payload must
/// have a signature from the immutable VPS report signer, bound to this receiver.
contract CommitPassSimulationAutomation is CommitPassAutomation {
    address public immutable simulationReportSigner;
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant REPORT_TYPEHASH = keccak256("SimulationReport(bytes payload)");

    constructor(address mockForwarder, address eventFactory, address reportSigner)
        CommitPassAutomation(mockForwarder, eventFactory) {
        require(block.chainid == 10143, "Monad testnet only");
        require(reportSigner != address(0) && reportSigner.code.length == 0, "Invalid report signer");
        simulationReportSigner = reportSigner;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("CommitPass CRE simulation"), keccak256("1"), block.chainid, address(this)
        ));
    }

    function configureWorkflow(bytes32) external pure override { revert("CLI simulation has no DON workflow ID"); }

    function _isConfigured() internal view override returns (bool) { return simulationReportSigner != address(0); }

    function simulationReportHash(bytes memory payload) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, keccak256(abi.encode(REPORT_TYPEHASH, keccak256(payload)))));
    }

    function _validatedPayload(bytes calldata, bytes calldata envelope) internal view override returns (bytes memory) {
        require(block.chainid == 10143, "Monad testnet only");
        require(msg.sender == forwarder, "Forwarder only");
        (bytes memory payload, bytes memory signature) = abi.decode(envelope, (bytes, bytes));
        require(ECDSA.recover(simulationReportHash(payload), signature) == simulationReportSigner, "Invalid simulation signature");
        return payload;
    }
}
