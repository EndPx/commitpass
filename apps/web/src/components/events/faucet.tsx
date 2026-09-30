"use client";
import { useState } from "react";
import { ArrowUpRight, Droplets } from "lucide-react";
import { EditorDialog } from "./editor-dialog";

export function Faucet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="workspace-faucet-link"
        aria-label="Faucet"
        title="Get test USDC or MON"
        onClick={() => setOpen(true)}
      >
        <Droplets size={16} />
        <span>Faucet</span>
      </button>
      {open && (
        <EditorDialog
          title="Faucet"
          icon={<Droplets size={24} />}
          onClose={() => setOpen(false)}
        >
          <div className="faucet-actions">
            <a
              className="button"
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Faucet USDC <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <a
              className="button"
              href="https://faucet.monad.xyz/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Faucet MON <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </EditorDialog>
      )}
    </>
  );
}
