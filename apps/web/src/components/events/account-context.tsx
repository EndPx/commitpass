"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import { jsonRequest } from "@/lib/events";

export type Session = {
  id: string;
  wallets: string[];
  name?: string;
  profileCompleted: boolean;
};
const AccountContext = createContext<{
  session: Session | null;
  connecting: boolean;
  error: string;
  refresh: () => void;
  updateSession: (session: Session) => void;
}>({
  session: null,
  connecting: true,
  error: "",
  refresh: () => {},
  updateSession: () => {},
});
export function AccountProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [session, setSession] = useState<Session | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    setSession(null);
    setError("");
    if (!ready) return;
    if (!authenticated || !user) {
      setConnecting(false);
      return;
    }
    const controller = new AbortController();
    setConnecting(true);
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Please sign in again.");
        const result = await jsonRequest<Session>("/api/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (result.id !== user.id) throw new Error("Please sign in again.");
        if (!controller.signal.aborted) setSession(result);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Could not connect your account.",
          );
      } finally {
        if (!controller.signal.aborted) setConnecting(false);
      }
    })();
    return () => controller.abort();
  }, [ready, authenticated, user?.id, getAccessToken, attempt]);
  return (
    <AccountContext.Provider
      value={{
        session: authenticated && session?.id === user?.id ? session : null,
        connecting,
        error,
        refresh,
        updateSession: setSession,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}
export const useAccount = () => useContext(AccountContext);
