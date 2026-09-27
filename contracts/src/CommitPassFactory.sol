// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CommitPassVault} from "./CommitPassVault.sol";

/**
 * @title CommitPassFactory
 * @dev Minimal factory contract untuk membuat CommitPassVault
 * @author ATFi Team
 */
contract CommitPassFactory {
    event VaultCreated(uint256 indexed eventId, address indexed vault, address indexed organizer, uint256 stakeAmount, uint256 maxParticipant, uint256 registrationDeadline, uint256 eventDate);

    mapping(address => bool) public isVault;
    uint256 public eventIdCounter = 1;
    address public immutable yieldVault;
    address public immutable treasury;
    mapping(uint256 => address) public vaultByEventId;

    constructor(address _yieldVault, address _treasury) {
        require(_yieldVault.code.length > 0 && _treasury != address(0), "Invalid configuration");
        yieldVault = _yieldVault;
        treasury = _treasury;
    }

    function createEvent(
        uint256 stakeAmount,
        uint256 registrationDeadline,
        uint256 eventDate,
        uint256 maxParticipant
    ) public returns (uint256) {
        require(registrationDeadline < eventDate, "Invalid deadline");
        require(registrationDeadline > block.timestamp, "Deadline in past");
        require(stakeAmount > 0, "Invalid stake amount");
        require(maxParticipant > 0, "Invalid max participants");

        uint256 newEventId = eventIdCounter;

        CommitPassVault vault = new CommitPassVault(newEventId, msg.sender, stakeAmount, registrationDeadline, eventDate, maxParticipant, yieldVault, treasury);
        address vaultAddress = address(vault);
        isVault[vaultAddress] = true;
        vaultByEventId[newEventId] = vaultAddress;

        emit VaultCreated(newEventId, vaultAddress, msg.sender, stakeAmount, maxParticipant, registrationDeadline, eventDate);

        eventIdCounter++;

        return newEventId;
    }

    // Atomic setup prevents deposits between event creation and schedule configuration.
    function createAutomatedEvent(
        uint256 stakeAmount,
        uint256 registrationDeadline,
        uint256 eventDate,
        uint256 maxParticipant,
        address automation,
        uint256 settleAt
    ) external returns (uint256 eventId) {
        eventId = createEvent(stakeAmount, registrationDeadline, eventDate, maxParticipant);
        CommitPassVault(vaultByEventId[eventId]).setAutomation(automation, settleAt);
    }

    // Check if address is a valid vault
    function isValidVault(address vault) external view returns (bool) {
        return isVault[vault];
    }
}
