"use client";
import dynamic from "next/dynamic";
const SessionRuntime = dynamic(() => import("./session-runtime"), {
  ssr: false,
});
export function LandingSessionGate() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? <SessionRuntime /> : null;
}
