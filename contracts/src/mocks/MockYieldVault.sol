// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

/// @notice Testnet mock assets. These tokens have no monetary value.
contract MockUSDC is ERC20 {
    constructor() ERC20("CommitPass Mock USDC", "USDC") {
        require(block.chainid == 10143 || block.chainid == 31337, "Testnet only");
    }

    function decimals() public pure override returns (uint8) { return 6; }

    function faucet() external { _mint(msg.sender, 1000e6); }
}

/// @notice A testnet ERC-4626 fixture; it does not invest in Clearstar or generate yield.
/// Anyone can donate testnet USDC to model a change in share value.
contract MockYieldVault is ERC4626 {
    constructor(IERC20 asset) ERC20("CommitPass Mock Yield", "mockYIELD") ERC4626(asset) {
        require(block.chainid == 10143 || block.chainid == 31337, "Testnet only");
    }
}
