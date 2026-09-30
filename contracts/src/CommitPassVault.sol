// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IEventAutomation {
    function registerEvent(address vault, uint256 settleAt) external;
    function canCancel(address vault) external view returns (bool);
}

contract CommitPassVault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable USDC_TOKEN;
    IERC4626 public immutable yieldVault;
    address public immutable treasury;
    address public immutable factory;
    uint256 public constant protocolFeeBps = 5000; // 50% of forfeited no-show principal only
    // 0 = pending, 1 = normal, 2 = zero attendance refund, 3 = cancelled
    uint8 public settlementOutcome;
    uint256 public protocolRevenue;
    uint256 public totalAllocated;
    uint256 public totalClaimed;

    // Event specific data
    uint256 public eventId;
    address public organizer;
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

    // Yield tracking
    uint256 public totalDepositedToYield;
    uint256 public totalYieldEarned;
    uint256 public totalNetYield;
    bool public depositedToYield;
    bool public eventSettled;
    address public automation;
    bool public registrationClosed;

    event AutomationConfigured(address indexed automation);
    event RegistrationClosed();

    modifier onlyLifecycleExecutor() {
        require(msg.sender == (automation == address(0) ? owner() : automation), "Unauthorized executor");
        _;
    }

    // Configure once, before accepting participant funds.
    function setAutomation(address executor, uint256 settleAt) external {
        require(msg.sender == owner() || msg.sender == factory, "Unauthorized configuration");
        require(automation == address(0) && participantAddresses.length == 0 && !depositedToYield, "Configuration locked");
        require(executor.code.length > 0, "Invalid executor");
        automation = executor;
        IEventAutomation(executor).registerEvent(address(this), settleAt);
        emit AutomationConfigured(executor);
    }

    function closeRegistration() external onlyLifecycleExecutor {
        if (!registrationClosed) {
            registrationClosed = true;
            emit RegistrationClosed();
        }
    }

    event DepositMade(address indexed participant, uint256 amount);
    event AttendanceMarked(address indexed participant);
    event EventSettled(uint256 totalYield, uint256 protocolFee);
    event DepositToYieldSource(uint256 amount);
    event RewardClaimed(address indexed participant, uint256 rewardAmount);
    event ClaimAllocated(address indexed participant, uint256 amount);
    event SettlementFinalized(uint8 outcome, uint256 noShowPrincipal, uint256 platformRevenue, uint256 totalAllocated);
    event EventCancelled();


    constructor(
        uint256 _eventId,
        address _organizer,
        uint256 _stakeAmount,
        uint256 _registrationDeadline,
        uint256 _eventDate,
        uint256 _maxParticipant,
        address _yieldVault,
        address _treasury
    ) ERC20("CommitPass Vault Share", "CommitPass-VS") Ownable(_organizer) {
        factory = msg.sender;
        require(_maxParticipant > 0, "Max participants must be greater than 0");
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


    /**
     * @dev Participants deposit the commitment asset to register for the event
     */
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

    /**
     * @dev Deposit pooled assets into the configured ERC-4626 yield vault
     */
    function depositToYieldSource() external onlyLifecycleExecutor nonReentrant {
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



    /**
     * @dev Settle event and calculate reward for Attended Participants
     */
    function settleEvent(address[] calldata _attendedParticipants) external onlyLifecycleExecutor nonReentrant {
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

    /// @notice Cancellation creates refundable claims; payouts occur individually.
    function cancelEvent() external onlyOwner nonReentrant {
        require(!eventSettled && !depositedToYield, "Event not cancellable");
        require(block.timestamp < eventDate, "Event start time passed");
        require(automation == address(0) || IEventAutomation(automation).canCancel(address(this)), "Start already requested");
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

    // Registration order deterministically receives any indivisible remainder.
    // All allocated units are conserved and never depend on claim order.
    function _allocate(uint256 available, bool refundAll) internal {
        uint256 eligible;
        for (uint256 i; i < participantAddresses.length; i++) {
            if (refundAll || participants[participantAddresses[i]].hasAttended) eligible++;
        }
        if (eligible == 0) { require(available == 0, "No refund recipients"); return; }
        uint256 each = available / eligible;
        uint256 remainder = available % eligible;
        for (uint256 i; i < participantAddresses.length; i++) {
            address participant = participantAddresses[i];
            if (refundAll || participants[participant].hasAttended) {
                uint256 claim = each;
                if (remainder > 0) { claim++; remainder--; }
                participants[participant].claimableRewards = claim;
                totalAllocated += claim;
                emit ClaimAllocated(participant, claim);
            }
        }
        require(totalAllocated == available, "Allocation mismatch");
    }

    function _withdrawAllFromYieldSource() internal {
        uint256 shares = yieldVault.balanceOf(address(this));
        if (shares > 0) yieldVault.redeem(shares, address(this), address(this));
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

    // View functions for assets management
    function totalAssets() public view returns (uint256) {
        if (depositedToYield) {
            if (eventSettled) {
                // After settlement: actual balance is accurate (protocol fee already deducted)
                return USDC_TOKEN.balanceOf(address(this));
            } else {
                // Before settlement: show gross assets (deposited + earned yield)
                return USDC_TOKEN.balanceOf(address(this)) + yieldVault.convertToAssets(yieldVault.balanceOf(address(this)));
            }
        }
        return USDC_TOKEN.balanceOf(address(this));
    }

    function maxDeposit(address) public view returns (uint256) {
        if (registrationClosed || depositedToYield || eventSettled || block.timestamp >= registrationDeadline) return 0;
        return stakeAmount;
    }

    function maxWithdraw(address _owner) public view returns (uint256) {
        Participant storage user = participants[_owner];
        if (!eventSettled || user.hasClaimed) return 0;
        return user.claimableRewards;
    }

    // View functions
    function getParticipantCount() external view returns (uint256) {
        return participantAddresses.length;
    }

    function getUserReward(address _user) external view returns (uint256) {
        return participants[_user].claimableRewards;
    }
}
