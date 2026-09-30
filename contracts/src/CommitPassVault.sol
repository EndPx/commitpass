// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ReceiverTemplate} from "./cre/ReceiverTemplate.sol";
import {IEventFactory} from "./interfaces/IEventFactory.sol";

/**
 * @title CommitPassVault
 * @notice Holds event commitments and receives authorized CRE lifecycle reports.
 */
contract CommitPassVault is ERC20, Ownable, ReentrancyGuard, ReceiverTemplate {
    using SafeERC20 for IERC20;

    // Immutable configuration
    IERC20 public immutable USDC_TOKEN;
    IERC4626 public immutable yieldVault;
    address public immutable treasury;
    address public immutable factory;
    address public immutable organizer;
    uint256 public immutable settleAt;

    // Settlement policy: 50% of forfeited no-show principal, no yield fee
    uint256 public constant protocolFeeBps = 5000;
    uint8 private constant START = 1;
    uint8 private constant SETTLE = 2;

    // Event data
    uint256 public eventId;
    uint256 public stakeAmount;
    uint256 public registrationDeadline;
    uint256 public eventDate;
    uint256 public maxParticipant;
    uint256 private eventSettlementTime;

    // Participant tracking
    struct Participant {
        bool hasDeposited;
        bool hasAttended;
        bool hasClaimed;
        uint256 claimableRewards;
    }

    mapping(address => Participant) public participants;
    address[] public participantAddresses;

    // Yield accounting
    uint256 public totalDepositedToYield;
    uint256 public totalYieldEarned;
    uint256 public totalNetYield;

    // Lifecycle state
    bool public depositedToYield;
    bool public eventSettled;
    bool public registrationClosed;
    bool public startRequested;
    uint256 public requestedCutoff;
    bytes32 public settledSnapshot;

    // Final allocations: 0 pending, 1 normal, 2 zero attendance, 3 cancelled
    uint8 public settlementOutcome;
    uint256 public protocolRevenue;
    uint256 public totalAllocated;
    uint256 public totalClaimed;

    // Events
    event DepositMade(address indexed participant, uint256 amount);
    event AttendanceMarked(address indexed participant);
    event EventSettled(uint256 totalYield, uint256 protocolFee);
    event DepositToYieldSource(uint256 amount);
    event RewardClaimed(address indexed participant, uint256 rewardAmount);
    event ClaimAllocated(address indexed participant, uint256 amount);
    event SettlementFinalized(uint8 outcome, uint256 noShowPrincipal, uint256 platformRevenue, uint256 totalAllocated);
    event RegistrationClosed();
    event EventCancelled();
    event LifecycleExecuted(address indexed vault, uint8 action, bytes32 snapshotHash);

    // Constructor

    constructor(
        uint256 _eventId,
        address _organizer,
        uint256 _stakeAmount,
        uint256 _registrationDeadline,
        uint256 _eventDate,
        uint256 _maxParticipant,
        address _yieldVault,
        address _treasury,
        uint256 _settleAt,
        address _forwarder,
        bytes32 _workflowId,
        address _simulationSigner
    )
        ERC20("CommitPass Vault Share", "CommitPass-VS")
        Ownable(_organizer)
        ReceiverTemplate(_forwarder, _workflowId, _simulationSigner)
    {
        factory = msg.sender;
        require(_maxParticipant > 0 && _maxParticipant <= 500, "Max participants must be greater than 0");
        require(
            _stakeAmount > 0 && _registrationDeadline > block.timestamp && _registrationDeadline < _eventDate
                && _settleAt > _eventDate,
            "Invalid event schedule"
        );
        settleAt = _settleAt;
        eventId = _eventId;
        organizer = _organizer;
        stakeAmount = _stakeAmount;
        registrationDeadline = _registrationDeadline;
        eventDate = _eventDate;
        maxParticipant = _maxParticipant;

        require(_yieldVault.code.length > 0 && _treasury != address(0), "Invalid yield configuration");
        yieldVault = IERC4626(_yieldVault);
        address usdc = yieldVault.asset();
        require(usdc.code.length > 0 && IERC20Metadata(usdc).decimals() == 6, "Invalid USDC asset");
        USDC_TOKEN = IERC20(usdc);
        treasury = _treasury;
    }

    // Participant actions

    function deposit() external nonReentrant {
        require(block.timestamp < registrationDeadline, "Registration deadline passed");
        require(!depositedToYield, "Event already started");
        require(!registrationClosed, "Registration closed");
        Participant storage user = participants[msg.sender];
        require(!user.hasDeposited, "Already deposited");
        require(!eventSettled, "Event already settled");
        require(participantAddresses.length < maxParticipant, "Max participants reached");

        USDC_TOKEN.safeTransferFrom(msg.sender, address(this), stakeAmount);
        _mint(msg.sender, stakeAmount);
        user.hasDeposited = true;
        participantAddresses.push(msg.sender);

        emit DepositMade(msg.sender, stakeAmount);
    }

    function claimReward() external nonReentrant {
        Participant storage user = participants[msg.sender];
        require(user.hasDeposited, "Not a participant");
        require(!user.hasClaimed, "Already claimed");
        require(eventSettled, "Event not settled");

        uint256 rewardAmount = user.claimableRewards;
        require(rewardAmount > 0, "No reward available");

        user.hasClaimed = true;
        totalClaimed += rewardAmount;

        if (totalAssets() < rewardAmount) {
            _withdrawAllFromYieldSource();
        }

        USDC_TOKEN.safeTransfer(msg.sender, rewardAmount);

        emit RewardClaimed(msg.sender, rewardAmount);
    }

    // Organizer actions

    function requestStart() external onlyOwner nonReentrant {
        require(!eventSettled && !depositedToYield, "Event not startable");
        require(participantAddresses.length > 0, "No participants");
        _closeRegistration();
        if (!startRequested) {
            startRequested = true;
            IEventFactory(factory).notifyLifecycleRequested(START);
        }
    }

    function requestSettlement() external onlyOwner {
        require(depositedToYield && !eventSettled, "Event not active");
        if (requestedCutoff == 0) {
            requestedCutoff = block.timestamp < settleAt ? block.timestamp : settleAt;
            IEventFactory(factory).notifyLifecycleRequested(SETTLE);
        }
    }

    function cancelEvent() external onlyOwner nonReentrant {
        require(!eventSettled && !depositedToYield, "Event not cancellable");
        require(block.timestamp < eventDate, "Event start time passed");
        require(!startRequested && requestedCutoff == 0, "Start already requested");
        uint256 principal = stakeAmount * participantAddresses.length;
        require(USDC_TOKEN.balanceOf(address(this)) >= principal, "Principal shortfall");
        registrationClosed = true;
        eventSettled = true;
        settlementOutcome = 3;
        eventSettlementTime = block.timestamp;
        // Before start, refund exactly each commitment. No cancellation fee.
        _allocate(principal, true);
        emit RegistrationClosed();
        emit EventCancelled();
        emit SettlementFinalized(3, 0, 0, totalAllocated);
    }

    function transferOwnership(address) public pure override {
        revert("Organizer immutable");
    }

    function renounceOwnership() public pure override {
        revert("Organizer immutable");
    }

    // Internal report execution

    function _processReport(bytes memory payload) internal override nonReentrant {
        (
            uint256 chainId,
            address target,
            uint8 action,
            uint256 validUntil,
            uint256 cutoff,
            bytes32 snapshotHash,
            address[] memory attendees
        ) = abi.decode(payload, (uint256, address, uint8, uint256, uint256, bytes32, address[]));
        require(chainId == block.chainid && target == address(this), "Wrong report domain");
        require(block.timestamp <= validUntil && validUntil <= block.timestamp + 10 minutes, "Invalid expiry");
        require(settlementOutcome != 3, "Event cancelled");
        (, uint8 readyAction, uint256 expectedCutoff) = getState();
        if (action == START) {
            require(attendees.length == 0 && snapshotHash == bytes32(0) && cutoff == 0, "Invalid start payload");
            if (depositedToYield) return;
            require(readyAction == START, "Start not due");
            _closeRegistration();
            _depositToYieldSource();
        } else {
            require(action == SETTLE && cutoff == expectedCutoff, "Invalid settlement");
            require(
                snapshotHash == keccak256(abi.encode(chainId, address(this), eventId, cutoff, attendees)),
                "Snapshot mismatch"
            );
            if (eventSettled) {
                require(settledSnapshot == snapshotHash, "Conflicting settlement");
                return;
            }
            require(readyAction == SETTLE, "Settlement not due");
            settledSnapshot = snapshotHash;
            _settleEvent(attendees);
        }
        emit LifecycleExecuted(address(this), action, snapshotHash);
    }

    function _closeRegistration() internal {
        if (!registrationClosed) {
            registrationClosed = true;
            emit RegistrationClosed();
        }
    }

    // Internal yield and allocation logic

    function _depositToYieldSource() internal {
        require(!depositedToYield && !eventSettled, "Event not startable");
        uint256 amountToDeposit = USDC_TOKEN.balanceOf(address(this));
        require(amountToDeposit > 0, "No assets to deposit");
        USDC_TOKEN.forceApprove(address(yieldVault), amountToDeposit);
        uint256 shares = yieldVault.deposit(amountToDeposit, address(this));
        require(shares > 0, "No yield shares received");
        USDC_TOKEN.forceApprove(address(yieldVault), 0);
        totalDepositedToYield = amountToDeposit;
        depositedToYield = true;
        registrationClosed = true;
        emit DepositToYieldSource(amountToDeposit);
    }

    function _settleEvent(address[] memory _attendedParticipants) internal {
        require(depositedToYield, "Not yet deposited to yield");
        require(!eventSettled, "Event already settled");

        require(_attendedParticipants.length <= participantAddresses.length, "Invalid attendance count");
        address previous;
        for (uint256 i; i < _attendedParticipants.length; i++) {
            address participant = _attendedParticipants[i];
            require(participant > previous && participants[participant].hasDeposited, "Invalid attendee");
            participants[participant].hasAttended = true;
            previous = participant;
            emit AttendanceMarked(participant);
        }
        _withdrawAllFromYieldSource();
        uint256 principal = stakeAmount * participantAddresses.length;
        uint256 balance = USDC_TOKEN.balanceOf(address(this));
        require(balance >= principal, "Principal shortfall");
        // All recovered surplus belongs to participants; there is no yield fee.
        totalYieldEarned = balance - principal;
        totalNetYield = totalYieldEarned;
        uint256 attendedCount = _attendedParticipants.length;
        uint256 noShowPrincipal = attendedCount == 0 ? 0 : (participantAddresses.length - attendedCount) * stakeAmount;
        protocolRevenue = noShowPrincipal / 2; // Floor the immutable 50% fee; odd units stay with guests.
        settlementOutcome = attendedCount == 0 ? 2 : 1;
        eventSettled = true;
        eventSettlementTime = block.timestamp;
        _allocate(balance - protocolRevenue, attendedCount == 0);
        if (protocolRevenue > 0) USDC_TOKEN.safeTransfer(treasury, protocolRevenue);
        emit EventSettled(totalYieldEarned, protocolRevenue);
        emit SettlementFinalized(settlementOutcome, noShowPrincipal, protocolRevenue, totalAllocated);
    }

    function _withdrawAllFromYieldSource() internal {
        uint256 shares = yieldVault.balanceOf(address(this));
        if (shares > 0) yieldVault.redeem(shares, address(this), address(this));
    }

    function _allocate(uint256 available, bool refundAll) internal {
        uint256 eligible;
        for (uint256 i; i < participantAddresses.length; i++) {
            if (refundAll || participants[participantAddresses[i]].hasAttended) eligible++;
        }
        if (eligible == 0) {
            require(available == 0, "No refund recipients");
            return;
        }
        uint256 each = available / eligible;
        uint256 remainder = available % eligible;
        for (uint256 i; i < participantAddresses.length; i++) {
            address participant = participantAddresses[i];
            if (refundAll || participants[participant].hasAttended) {
                uint256 claim = each;
                if (remainder > 0) {
                    claim++;
                    remainder--;
                }
                participants[participant].claimableRewards = claim;
                totalAllocated += claim;
                emit ClaimAllocated(participant, claim);
            }
        }
        require(totalAllocated == available, "Allocation mismatch");
    }

    // View functions

    function settlementCutoff() public view returns (uint256) {
        return requestedCutoff == 0 ? settleAt : requestedCutoff;
    }

    function getSchedule() external view returns (uint256, uint256, uint256, bool, bytes32) {
        return (eventDate, settleAt, requestedCutoff, startRequested, settledSnapshot);
    }

    function getState() public view returns (uint256, uint8 action, uint256) {
        uint256 cutoff = settlementCutoff();
        if (!eventSettled) {
            if (
                !depositedToYield && participantAddresses.length > 0 && (startRequested || block.timestamp >= eventDate)
            ) action = START;
            else if (depositedToYield && block.timestamp >= cutoff) action = SETTLE;
        }
        return (eventId, action, cutoff);
    }

    function totalAssets() public view returns (uint256) {
        if (depositedToYield) {
            if (eventSettled) {
                // After settlement: actual balance is accurate (protocol fee already deducted)
                return USDC_TOKEN.balanceOf(address(this));
            } else {
                // Before settlement: show gross assets (deposited + earned yield)
                return
                    USDC_TOKEN.balanceOf(address(this))
                        + yieldVault.convertToAssets(yieldVault.balanceOf(address(this)));
            }
        }
        return USDC_TOKEN.balanceOf(address(this));
    }

    function maxDeposit(address) public view returns (uint256) {
        if (registrationClosed || depositedToYield || eventSettled || block.timestamp >= registrationDeadline) {
            return 0;
        }
        return stakeAmount;
    }

    function maxWithdraw(address _owner) public view returns (uint256) {
        Participant storage user = participants[_owner];
        if (!eventSettled || user.hasClaimed) return 0;
        return user.claimableRewards;
    }

    function getParticipantCount() external view returns (uint256) {
        return participantAddresses.length;
    }

    function getUserReward(address _user) external view returns (uint256) {
        return participants[_user].claimableRewards;
    }
}
