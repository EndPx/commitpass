"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCreateWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { ArrowUpRight, Copy, Droplets } from "lucide-react";
import { useAccount } from "./account-context";
import { EditorDialog } from "./editor-dialog";

export function Faucet() {
  const path = usePathname();
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { session, connecting, error: accountError, refresh } = useAccount();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const verified = session?.wallets ?? [];
  const embedded = wallets.find(
    (wallet) =>
      wallet.walletClientType === "privy" &&
      verified.some(
        (address) => address.toLowerCase() === wallet.address.toLowerCase(),
      ),
  )?.address;
  const destination = verified.includes(selected)
    ? selected
    : (verified.find(
        (address) => address.toLowerCase() === embedded?.toLowerCase(),
      ) ??
      verified[0] ??
      "");
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(destination);
      setCopied(destination);
      setError("");
    } catch {
      setError(
        "Couldn’t copy automatically. Select and copy your address below.",
      );
    }
  };
  return (
    <>
      <button
        className="workspace-faucet-link"
        aria-label="Faucet"
        title="Get test USDC"
        onClick={() => {
          setOpen(true);
          setError("");
          setCopied("");
        }}
      >
        <Droplets size={16} />
        <span>Faucet</span>
      </button>
      {open && (
        <EditorDialog
          title="Get test USDC"
          icon={<Droplets size={24} />}
          onClose={() => setOpen(false)}
          busy={creating}
        >
          {!ready || connecting ? (
            <p className="faucet-info" role="status">
              Getting your wallet ready…
            </p>
          ) : !authenticated ? (
            <>
              <p className="faucet-info">
                Sign in to use your CommitPass wallet as the recipient.
              </p>
              <Link
                className="button button--dark faucet-continue"
                href={`/signin?next=${encodeURIComponent(path)}`}
              >
                Sign in
              </Link>
            </>
          ) : accountError ? (
            <>
              <p className="faucet-info" role="alert">
                {accountError}
              </p>
              <button className="button faucet-continue" onClick={refresh}>
                Try again
              </button>
            </>
          ) : !destination ? (
            <>
              <p className="faucet-info">
                Set up your wallet to receive USDC on Monad testnet.
              </p>
              <button
                className="button button--dark faucet-continue"
                disabled={creating}
                onClick={async () => {
                  setCreating(true);
                  setError("");
                  try {
                    await createWallet();
                    refresh();
                  } catch (value) {
                    setError(
                      value instanceof Error
                        ? value.message
                        : "Couldn’t set up your wallet. Please try again.",
                    );
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                {creating ? "Setting up wallet…" : "Create your wallet"}
              </button>
            </>
          ) : (
            <>
              <div className="faucet-fields">
                <label>
                  Asset
                  <input readOnly value="USDC" />
                </label>
                <label>
                  Network
                  <input readOnly value="Monad Testnet" />
                </label>
                <label>
                  Send to
                  {verified.length > 1 ? (
                    <select
                      value={destination}
                      onChange={(event) => {
                        setSelected(event.target.value);
                        setCopied("");
                      }}
                    >
                      {verified.map((address) => (
                        <option key={address} value={address}>
                          {address}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input readOnly value={destination} />
                  )}
                </label>
              </div>
              <p className="faucet-info">
                On Circle, choose <strong>Monad Testnet</strong> and paste this
                address into <strong>Send to</strong>.
              </p>
              <div className="faucet-actions">
                <button className="button" onClick={copyAddress}>
                  <Copy size={15} />
                  {copied === destination ? "Copied" : "Copy address"}
                </button>
                <a
                  className="button button--dark"
                  href="https://faucet.circle.com/"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => void copyAddress()}
                >
                  Copy & open Circle <ArrowUpRight size={15} />
                </a>
              </div>
              {copied === destination && (
                <p className="faucet-status" role="status">
                  Your wallet address is copied.
                </p>
              )}
            </>
          )}
          {error && (
            <p className="faucet-info" role="alert">
              {error}
            </p>
          )}
        </EditorDialog>
      )}
    </>
  );
}
