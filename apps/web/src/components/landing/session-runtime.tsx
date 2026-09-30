"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { AuthProvider } from "@/components/auth/provider";
function RedirectSignedIn() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  useEffect(() => {
    if (ready && authenticated) router.replace("/events");
  }, [ready, authenticated, router]);
  return null;
}
export default function SessionRuntime() {
  return (
    <AuthProvider>
      <RedirectSignedIn />
    </AuthProvider>
  );
}
