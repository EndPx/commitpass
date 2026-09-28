"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { activeChain } from "@/lib/runtime-network";

export const authConfigured = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#b9462d",
          logo: "/brand/commitpass-mark.png",
          walletChainType: "ethereum-only",
        },
        loginMethods:
          process.env.NEXT_PUBLIC_PRIVY_GOOGLE_ENABLED === "true"
            ? ["email", "google"]
            : ["email"],
        defaultChain: activeChain,
        supportedChains: [activeChain],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
