"use client";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
const Runtime = dynamic(() => import("./platform-runtime"), {
  ssr: false,
  loading: () => (
    <div className="workspace-loading" role="status">
      Getting your plans ready…
    </div>
  ),
});
export function PlatformShell({ children }: { children: ReactNode }) {
  return <Runtime>{children}</Runtime>;
}
