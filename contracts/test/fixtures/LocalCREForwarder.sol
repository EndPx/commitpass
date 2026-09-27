// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IReportReceiver} from "../../src/CommitPassAutomation.sol";

/// @notice Anvil-only fixture for CRE CLI simulation, NOT a DON signature verifier.
/// Its report/getTransmissionInfo ABI follows Chainlink's MockKeystoneForwarder.
/// The local runner installs this bytecode with anvil_setCode, never on a public RPC.
contract LocalCREForwarder {
    bytes32 public constant WORKFLOW_ID = keccak256("commitpass-local-simulation");
    address public immutable relayer;

    struct TransmissionInfo {
        bytes32 transmissionId;
        uint8 state;
        address transmitter;
        bool invalidReceiver;
        bool success;
        uint80 gasLimit;
    }

    mapping(bytes32 => TransmissionInfo) private transmissions;
    event ReportProcessed(address indexed receiver, bytes32 indexed workflowExecutionId, bytes2 indexed reportId, bool result);

    constructor(address localRelayer) { relayer = localRelayer; }

    function getTransmissionId(address receiver, bytes32 executionId, bytes2 reportId) public pure returns (bytes32) {
        return keccak256(bytes.concat(bytes20(receiver), executionId, reportId));
    }

    function getTransmissionInfo(address receiver, bytes32 executionId, bytes2 reportId) external view returns (TransmissionInfo memory) {
        return transmissions[getTransmissionId(receiver, executionId, reportId)];
    }

    function getTransmitter(address receiver, bytes32 executionId, bytes2 reportId) external view returns (address) {
        return transmissions[getTransmissionId(receiver, executionId, reportId)].transmitter;
    }

    function report(address receiver, bytes calldata rawReport, bytes calldata, bytes[] calldata) external {
        require(msg.sender == relayer, "Local relayer only");
        require(rawReport.length >= 109, "Invalid report");
        bytes32 executionId = bytes32(rawReport[1:33]);
        bytes2 reportId = bytes2(rawReport[107:109]);
        // CLI reports are not deployed DON reports. Pin a local fixture identity explicitly.
        bytes memory metadata = bytes.concat(WORKFLOW_ID, rawReport[77:109]);
        uint80 gasLimit = uint80(gasleft());
        (bool success,) = receiver.call(abi.encodeCall(IReportReceiver.onReport, (metadata, rawReport[109:])));
        bytes32 id = getTransmissionId(receiver, executionId, reportId);
        transmissions[id] = TransmissionInfo(id, success ? 1 : 3, msg.sender, false, success, gasLimit);
        emit ReportProcessed(receiver, executionId, reportId, success);
    }
}
