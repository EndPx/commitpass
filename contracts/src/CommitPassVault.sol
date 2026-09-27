// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IEventAutomation {
    function registerEvent(address vault, uint256 settleAt) external;
}

contract CommitPassVault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable ASSET_TOKEN;
    IERC4626 public immutable yieldVault;
    uint256 private constant BPS_PRECISION = 10000;
    address public immutable treasury;
    address public immutable factory;
    uint256 public protocolFeeBps = 500; // PRD 2.5: 5% protocol fee (500 bps)

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
        ASSET_TOKEN = IERC20(yieldVault.asset());
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

        ASSET_TOKEN.safeTransferFrom(msg.sender, address(this), stakeAmount);
        _mint(msg.sender, stakeAmount);
        user.hasDeposited = true;
        participantAddresses.push(msg.sender);

        emit DepositMade(msg.sender, stakeAmount);
    }

    /**
     * @dev Deposit pooled assets into the configured ERC-4626 yield vault
     */
    function depositToYieldSource() external onlyLifecycleExecutor nonReentrant {
        require(!depositedToYield, "Already deposited to yield");
        uint256 amountToDeposit = ASSET_TOKEN.balanceOf(address(this));
        require(amountToDeposit > 0, "No assets to deposit");
        ASSET_TOKEN.forceApprove(address(yieldVault), amountToDeposit);
        uint256 shares = yieldVault.deposit(amountToDeposit, address(this));
        require(shares > 0, "No yield shares received");
        ASSET_TOKEN.forceApprove(address(yieldVault), 0);
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

        for (uint256 i = 0; i < _attendedParticipants.length; i++) {
            address participantAddr = _attendedParticipants[i];
            Participant storage user = participants[participantAddr];
            if (user.hasDeposited && !user.hasAttended) {
                user.hasAttended = true;
                emit AttendanceMarked(participantAddr);
            }
        }

        _withdrawAllFromYieldSource();

        // Calculate realized yield after redemption (real balance - original deposited amount)
        uint256 currentBalance = ASSET_TOKEN.balanceOf(address(this));
        require(currentBalance >= stakeAmount * participantAddresses.length, "Principal shortfall");
        uint256 actualYieldEarned = currentBalance > totalDepositedToYield ? currentBalance - totalDepositedToYield : 0;
        totalYieldEarned = actualYieldEarned;

        // Take 5% of actual yield for treasury (skip if yield is 0)
        uint256 protocolFeeAmount = actualYieldEarned > 0 ? (actualYieldEarned * protocolFeeBps) / BPS_PRECISION : 0;
        totalNetYield = totalYieldEarned - protocolFeeAmount;

        if (protocolFeeAmount > 0) {
            ASSET_TOKEN.safeTransfer(treasury, protocolFeeAmount);
        }

        _calculateRewards();
        eventSettled = true;
        eventSettlementTime = block.timestamp;
        emit EventSettled(totalYieldEarned, protocolFeeAmount);
    }

    function _withdrawAllFromYieldSource() internal {
        uint256 shares = yieldVault.balanceOf(address(this));
        if (shares > 0) yieldVault.redeem(shares, address(this), address(this));
    }

    function claimReward() external nonReentrant {
        Participant storage user = participants[msg.sender];
        require(user.hasDeposited, "Not a participant");
        require(user.hasAttended, "Did not attend");
        require(!user.hasClaimed, "Already claimed");
        require(eventSettled, "Event not settled");

        uint256 rewardAmount = user.claimableRewards;
        require(rewardAmount > 0, "No reward available");

        user.hasClaimed = true;

        if (totalAssets() < rewardAmount) {
            _withdrawAllFromYieldSource();
        }

        ASSET_TOKEN.safeTransfer(msg.sender, rewardAmount);

        emit RewardClaimed(msg.sender, rewardAmount);
    }

    /**
     * @dev Hitung reward untuk setiap peserta yang hadir
     * Formula: Stake Awal + ((Total No-Show Stake + Net Yield) / Jumlah Peserta Hadir)
     */
    function _calculateRewards() internal {
        uint256 attendedCount;
        uint256 totalNoShowStake;

        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address participantAddr = participantAddresses[i];
            if (participants[participantAddr].hasAttended) {
                attendedCount++;
            } else {
                totalNoShowStake += stakeAmount;
            }
        }

        if (attendedCount == 0) return;

        uint256 bonusPerParticipant = (totalNoShowStake + totalNetYield) / attendedCount;

        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address participantAddr = participantAddresses[i];
            Participant storage user = participants[participantAddr];
            if (user.hasAttended) {
                user.claimableRewards = stakeAmount + bonusPerParticipant;
            }
        }
    }

    // View functions for assets management
    function totalAssets() public view returns (uint256) {
        if (depositedToYield) {
            if (eventSettled) {
                // After settlement: actual balance is accurate (protocol fee already deducted)
                return ASSET_TOKEN.balanceOf(address(this));
            } else {
                // Before settlement: show gross assets (deposited + earned yield)
                return ASSET_TOKEN.balanceOf(address(this)) + yieldVault.convertToAssets(yieldVault.balanceOf(address(this)));
            }
        }
        return ASSET_TOKEN.balanceOf(address(this));
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
