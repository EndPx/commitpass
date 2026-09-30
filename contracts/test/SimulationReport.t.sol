// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {CommitPassFactory} from "../src/CommitPassFactory.sol";
import {CommitPassVault} from "../src/CommitPassVault.sol";
import {MockUSDC, MockYieldVault} from "../src/mocks/MockYieldVault.sol";

contract SimulationReportTest is Test {
    MockUSDC internal asset;
    CommitPassFactory internal factory;
    CommitPassVault internal vault;
    uint256 private constant SIGNER_KEY = 123;

    function setUp() public {
        vm.chainId(10143);
        asset = new MockUSDC();
        MockYieldVault yieldVault = new MockYieldVault(asset);
        factory =
            new CommitPassFactory(address(yieldVault), address(0xBEEF), address(this), bytes32(0), vm.addr(SIGNER_KEY));
        vault = _create();
        asset.faucet();
        asset.approve(address(vault), 1e6);
        vault.deposit();
        vault.requestStart();
    }

    function _create() internal returns (CommitPassVault) {
        uint256 id = factory.createEvent(
            1e6, block.timestamp + 1 hours, block.timestamp + 2 hours, 3, block.timestamp + 3 hours
        );
        return CommitPassVault(factory.vaultByEventId(id));
    }

    function _report(address target, address domainVault, uint256 signerKey) internal returns (bytes memory) {
        bytes memory payload = abi.encode(
            block.chainid, target, uint8(1), block.timestamp + 5 minutes, uint256(0), bytes32(0), new address[](0)
        );
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("CommitPass CRE simulation"),
                keccak256("1"),
                block.chainid,
                domainVault
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domain,
                keccak256(abi.encode(keccak256("SimulationReport(bytes payload)"), keccak256(payload)))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encode(payload, abi.encodePacked(r, s, v));
    }

    function testSignedReportStartsOnce() public {
        bytes memory report = _report(address(vault), address(vault), SIGNER_KEY);
        vault.onReport("", report);
        vault.onReport("", report);
        assertTrue(vault.depositedToYield());
        assertEq(vault.totalDepositedToYield(), 1e6);
    }

    function testMockForwarderCannotBypassSigner() public {
        bytes memory report = _report(address(vault), address(vault), 456);
        vm.expectRevert("Invalid simulation signature");
        vault.onReport("", report);
        assertFalse(vault.depositedToYield());
    }

    function testSignatureCannotBeReusedAcrossVaults() public {
        CommitPassVault other = _create();
        bytes memory report = _report(address(other), address(vault), SIGNER_KEY);
        vm.expectRevert("Invalid simulation signature");
        other.onReport("", report);
    }

    function testSignatureDoesNotAllowWrongReportTarget() public {
        bytes memory report = _report(address(0xBAD), address(vault), SIGNER_KEY);
        vm.expectRevert("Wrong report domain");
        vault.onReport("", report);
    }
}
