"use client";

import dynamic from "next/dynamic";
import { LoaderCircle, LogIn } from "lucide-react";

const PrivySignIn = dynamic(() => import("./privy-sign-in"), {
  ssr: false,
  loading: () => (
    <section
      className="auth-card"
      aria-labelledby="signin-title"
      aria-busy="true"
    >
      <div className="auth-card-body">
        <span className="auth-symbol">
          <LogIn size={28} strokeWidth={1.5} />
        </span>
        <h1 id="signin-title">Welcome to CommitPass</h1>
        <p className="auth-description">Sign in or create an account below.</p>
        <p className="auth-loading" role="status">
          <LoaderCircle className="auth-spinner" size={18} /> Getting sign-in
          ready…
        </p>
      </div>
    </section>
  ),
});

export function SignIn() {
  return <PrivySignIn />;
}
