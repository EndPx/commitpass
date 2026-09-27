// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CommitPassFactory} from "./CommitPassFactory.sol";
import {CommitPassVault} from "./CommitPassVault.sol";

interface IReportReceiver {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/// @notice CRE lifecycle authorization. Attendance remains an organizer attestation.
contract CommitPassAutomation is IReportReceiver, IERC165, ReentrancyGuard {
    uint8 public constant START = 1;
    uint8 public constant SETTLE = 2;

    struct Schedule {
        uint256 startAt;
        uint256 settleAt;
        uint256 requestedCutoff;
        bool startRequested;
        bytes32 settledSnapshot;
    }

    address public immutable forwarder;
    address public immutable configurator;
    bytes32 public workflowId;
    CommitPassFactory public immutable factory;
    mapping(address => Schedule) public schedules;
    address[] public vaults;

    event EventRegistered(address indexed vault, uint256 startAt, uint256 settleAt);
    event LifecycleRequested(address indexed vault, uint8 action);
    event LifecycleExecuted(address indexed vault, uint8 action, bytes32 snapshotHash);
    event WorkflowConfigured(bytes32 indexed workflowId);

    constructor(address trustedForwarder, address eventFactory) {
        require(trustedForwarder.code.length > 0 && eventFactory.code.length > 0, "Invalid contract");
        forwarder = trustedForwarder;
        configurator = msg.sender;
        factory = CommitPassFactory(eventFactory);
    }

    // Set once after CRE registration resolves the workflow ID for this receiver's config.
    function configureWorkflow(bytes32 expectedWorkflowId) external {
        require(msg.sender == configurator && workflowId == bytes32(0), "Configuration locked");
        require(expectedWorkflowId != bytes32(0), "Invalid workflow");
        workflowId = expectedWorkflowId;
        emit WorkflowConfigured(expectedWorkflowId);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IReportReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function registerEvent(address vault, uint256 settleAt) external {
        require(workflowId != bytes32(0), "Workflow not configured");
        require(factory.isVault(vault), "Unknown vault");
        CommitPassVault eventVault = CommitPassVault(vault);
        require(msg.sender == vault, "Vault only");
        require(eventVault.automation() == address(this), "Executor not configured");
        require(eventVault.maxParticipant() <= 500, "Automation capacity exceeded");
        require(schedules[vault].startAt == 0 && eventVault.getParticipantCount() == 0, "Registration locked");
        uint256 startAt = eventVault.eventDate();
        require(startAt > block.timestamp && settleAt > startAt, "Invalid schedule");
        schedules[vault] = Schedule(startAt, settleAt, 0, false, bytes32(0));
        vaults.push(vault);
        emit EventRegistered(vault, startAt, settleAt);
    }

    function requestStart(address vault) external nonReentrant {
        Schedule storage schedule = schedules[vault];
        CommitPassVault eventVault = CommitPassVault(vault);
        require(schedule.startAt != 0 && msg.sender == eventVault.owner(), "Organizer only");
        require(!eventVault.depositedToYield(), "Already started");
        require(eventVault.getParticipantCount() > 0, "No participants");
        eventVault.closeRegistration();
        if (!schedule.startRequested) {
            schedule.startRequested = true;
            emit LifecycleRequested(vault, START);
        }
    }

    function requestSettlement(address vault) external {
        Schedule storage schedule = schedules[vault];
        CommitPassVault eventVault = CommitPassVault(vault);
        require(schedule.startAt != 0 && msg.sender == eventVault.owner(), "Organizer only");
        require(eventVault.depositedToYield() && !eventVault.eventSettled(), "Event not active");
        if (schedule.requestedCutoff == 0) {
            schedule.requestedCutoff = block.timestamp < schedule.settleAt ? block.timestamp : schedule.settleAt;
            emit LifecycleRequested(vault, SETTLE);
        }
    }

    function vaultCount() external view returns (uint256) {
        return vaults.length;
    }

    // Stateless round-robin discovery; manual requests use the log trigger immediately.
    function getBatch(uint256 slot) external view returns (address[] memory result) {
        uint256 count = vaults.length;
        uint256 size = count < 2 ? count : 2;
        result = new address[](size);
        for (uint256 i; i < size; ++i) result[i] = vaults[((slot % count) * 2 + i) % count];
    }

    function getState(address vault) public view returns (uint256 eventId, uint8 action, uint256 cutoff) {
        Schedule memory schedule = schedules[vault];
        if (schedule.startAt == 0) return (0, 0, 0);
        CommitPassVault eventVault = CommitPassVault(vault);
        eventId = eventVault.eventId();
        cutoff = schedule.requestedCutoff == 0 ? schedule.settleAt : schedule.requestedCutoff;
        if (eventVault.eventSettled()) return (eventId, 0, cutoff);
        if (!eventVault.depositedToYield()) {
            if ((schedule.startRequested || block.timestamp >= schedule.startAt) && eventVault.getParticipantCount() > 0) {
                return (eventId, START, cutoff);
            }
        } else if (block.timestamp >= cutoff) {
            return (eventId, SETTLE, cutoff);
        }
    }

    function onReport(bytes calldata metadata, bytes calldata report) external nonReentrant {
        require(msg.sender == forwarder, "Forwarder only");
        require(workflowId != bytes32(0) && metadata.length == 64 && bytes32(metadata[:32]) == workflowId, "Invalid workflow metadata");
        (uint256 chainId, address vault, uint8 action, uint256 validUntil, uint256 cutoff, bytes32 snapshotHash, address[] memory attendees) =
            abi.decode(report, (uint256, address, uint8, uint256, uint256, bytes32, address[]));
        require(chainId == block.chainid, "Wrong chain");
        require(block.timestamp <= validUntil && validUntil <= block.timestamp + 10 minutes, "Invalid expiry");
        Schedule storage schedule = schedules[vault];
        require(schedule.startAt != 0, "Unknown event");
        CommitPassVault eventVault = CommitPassVault(vault);
        (uint256 eventId, uint8 readyAction, uint256 expectedCutoff) = getState(vault);
        if (action == START) {
            require(attendees.length == 0 && snapshotHash == bytes32(0) && cutoff == 0, "Invalid start payload");
            if (eventVault.depositedToYield()) return;
            require(readyAction == START, "Start not due");
            eventVault.closeRegistration();
            eventVault.depositToYieldSource();
        } else {
            require(action == SETTLE && cutoff == expectedCutoff, "Invalid settlement");
            require(attendees.length > 0 && attendees.length <= eventVault.getParticipantCount(), "Invalid attendance count");
            require(snapshotHash == keccak256(abi.encode(chainId, vault, eventId, cutoff, attendees)), "Snapshot mismatch");
            if (eventVault.eventSettled()) {
                require(schedule.settledSnapshot == snapshotHash, "Conflicting settlement");
                return;
            }
            require(readyAction == SETTLE, "Settlement not due");
            address previous;
            for (uint256 i; i < attendees.length; ++i) {
                require(attendees[i] > previous, "Attendance must be sorted and unique");
                (bool deposited,,,) = eventVault.participants(attendees[i]);
                require(deposited, "Unknown participant");
                previous = attendees[i];
            }
            schedule.settledSnapshot = snapshotHash;
            eventVault.settleEvent(attendees);
        }
        emit LifecycleExecuted(vault, action, snapshotHash);
    }
}
