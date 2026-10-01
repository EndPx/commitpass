import type { ReactNode } from "react";
import { PlatformShell } from "@/components/events/platform-shell";
import "./workspace.css";
import "./editor.css";
import "./lifecycle.css";
import "./lists.css";
import "./profile.css";
import "./onboarding.css";
import "./discovery.css";
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div className="platform">
      <PlatformShell>{children}</PlatformShell>
    </div>
  );
}
