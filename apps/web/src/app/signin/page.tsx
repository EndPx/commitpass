import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/landing/brand";
import { SignIn } from "@/components/auth/sign-in";
import "./signin.css";

export const metadata: Metadata = {
  title: "Sign in · CommitPass",
  description:
    "Sign in or create your CommitPass account. Good plans start here.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <div className="auth-page">
      <a className="skip-link" href="#signin-main">
        Skip to sign in
      </a>
      <header className="auth-header">
        <Brand href="/" />
        <nav aria-label="Sign-in navigation">
          <Link className="auth-about-link" href="/#how-it-works">
            How it works
          </Link>
          <Link className="button button--small" href="/">
            <ArrowLeft size={14} /> Back home
          </Link>
        </nav>
      </header>
      <main className="auth-main" id="signin-main">
        <div className="auth-intro">
          <SignIn />
          <p className="auth-caption">
            A little commitment. A lot to look forward to.
          </p>
        </div>
      </main>
    </div>
  );
}
