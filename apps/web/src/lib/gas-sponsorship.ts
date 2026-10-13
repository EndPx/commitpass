import { MONAD_TESTNET } from "@commitpass/shared";
import { activeChain, isLocal } from "./runtime-network";

type TransactionWallet = { address: string; walletClientType: string };

export const testnetGasSponsorshipEnabled =
  process.env.NEXT_PUBLIC_COMMITPASS_TESTNET_GAS_SPONSORSHIP === "true" &&
  !isLocal &&
  activeChain.id === MONAD_TESTNET.chainId;

export function privyTransactionOptions(wallet: TransactionWallet) {
  return {
    address: wallet.address,
    sponsor:
      testnetGasSponsorshipEnabled && wallet.walletClientType === "privy",
    uiOptions: { showWalletUIs: true },
  };
}
