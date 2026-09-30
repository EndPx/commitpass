---
description: Open the app, sign in, and prepare your Monad testnet wallet.
---

# Getting started

## Browse first

Open [Discover](https://commitpass-kappa.vercel.app/discover) to explore public events and their details. Browsing does not require an account. Sign in when you want to reserve a place or create an event.

## Sign in

Use [Sign in](https://commitpass-kappa.vercel.app/signin) with email or Google. The application uses Privy for authentication and embedded wallet access. After the session is verified, the app opens your event workspace.

Your account menu shows your full wallet address with a copy button. Use the address belonging to the wallet you will approve transactions with.

## Get testnet tokens

Open **Faucet** from the app navigation. The popup shows the wallet address and two links:

| Token | Faucet                                      | Purpose           |
| ----- | ------------------------------------------- | ----------------- |
| USDC  | [Circle Faucet](https://faucet.circle.com/) | Event commitments |
| MON   | [Monad Faucet](https://faucet.monad.xyz/)   | Transaction gas   |

At Circle Faucet, select **Monad Testnet** and send USDC to the address copied from CommitPass. At Monad Faucet, request testnet MON for the same wallet. Complete any verification requested by the provider yourself.

Check the chosen network before requesting or using tokens. USDC issued on Base Sepolia is a different contract and cannot be used as a Monad event commitment.

## Check your time settings

The app supports a selected display timezone and UTC offset. Use Settings when you want to change the display timezone, appearance or background. The event editor also records the host's selected event timezone.

For example, `Asia/Jakarta · UTC+07:00` and `UTC+00:00` can display different clock times for the same instant. Compare the timezone as well as the time when planning a demo or attending an event.

## Choose your next step

- [Reserve a place](guests.md).
- [Create an event](hosts.md).
- [Understand commitment returns](../protocol/commitments-and-rewards.md).

The current release uses testnet tokens with no financial value. Transaction gas is paid separately from the commitment.
