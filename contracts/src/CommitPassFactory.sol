// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CommitPassVault} from "./CommitPassVault.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CommitPassFactory
 * @notice Creates event vaults with their schedule and CRE authorization atomically.
 */
contract CommitPassFactory is ReentrancyGuard {
    event VaultCreated(
        uint256 indexed eventId,
        address indexed vault,
        address indexed organizer,
        uint256 stakeAmount,
        uint256 maxParticipant,
        uint256 registrationDeadline,
        uint256 eventDate
    );
    event EventRegistered(address indexed vault, uint256 startAt, uint256 settleAt);
    event LifecycleRequested(address indexed vault, uint8 action);

    mapping(address => bool) public isVault;
    uint256 public eventIdCounter = 1;
    address public immutable yieldVault;
    address public immutable treasury;
    address public immutable forwarder;
    bytes32 public immutable workflowId;
    address public immutable simulationReportSigner;
    mapping(uint256 => address) public vaultByEventId;

    constructor(
        address _yieldVault,
        address _treasury,
        address _forwarder,
        bytes32 _workflowId,
        address _simulationSigner
    ) {
        require(_yieldVault.code.length > 0 && _treasury != address(0), "Invalid configuration");
        require(_forwarder.code.length > 0, "Invalid forwarder");
        if (_simulationSigner != address(0)) {
            require(
                block.chainid == 10143 && _simulationSigner.code.length == 0 && _workflowId == bytes32(0),
                "Invalid simulation configuration"
            );
        } else {
            require(_workflowId != bytes32(0), "Workflow identity required");
        }
        yieldVault = _yieldVault;
        treasury = _treasury;
        forwarder = _forwarder;
        workflowId = _workflowId;
        simulationReportSigner = _simulationSigner;
    }

    function createEvent(
        uint256 stakeAmount,
        uint256 registrationDeadline,
        uint256 eventDate,
        uint256 maxParticipant,
        uint256 settleAt
    ) external nonReentrant returns (uint256) {
        require(registrationDeadline < eventDate, "Invalid deadline");
        require(registrationDeadline > block.timestamp, "Deadline in past");
        require(stakeAmount > 0, "Invalid stake amount");
        require(maxParticipant > 0 && maxParticipant <= 500, "Invalid max participants");
        require(settleAt > eventDate, "Invalid settlement time");

        uint256 newEventId = eventIdCounter;

        eventIdCounter++;
        CommitPassVault vault = new CommitPassVault(
            newEventId,
            msg.sender,
            stakeAmount,
            registrationDeadline,
            eventDate,
            maxParticipant,
            yieldVault,
            treasury,
            settleAt,
            forwarder,
            workflowId,
            simulationReportSigner
        );
        address vaultAddress = address(vault);
        isVault[vaultAddress] = true;
        vaultByEventId[newEventId] = vaultAddress;

        emit VaultCreated(
            newEventId, vaultAddress, msg.sender, stakeAmount, maxParticipant, registrationDeadline, eventDate
        );
        emit EventRegistered(vaultAddress, eventDate, settleAt);

        return newEventId;
    }

    function isConfigured() external view returns (bool) {
        return workflowId != bytes32(0) || simulationReportSigner != address(0);
    }

    function getBatch(uint256 slot) external view returns (address[] memory result) {
        uint256 count = eventIdCounter - 1;
        uint256 size = count < 2 ? count : 2;
        result = new address[](size);
        for (uint256 i; i < size; ++i) {
            result[i] = vaultByEventId[((slot % count) * 2 + i) % count + 1];
        }
    }

    // One fixed factory log source lets CRE discover requests from every event vault.
    function notifyLifecycleRequested(uint8 action) external {
        require(isVault[msg.sender] && (action == 1 || action == 2), "Vault request only");
        emit LifecycleRequested(msg.sender, action);
    }

    // Check if address is a valid vault
    function isValidVault(address vault) external view returns (bool) {
        return isVault[vault];
    }
}
