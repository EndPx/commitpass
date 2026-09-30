import brandMedia from "@/lib/brand-media.json";
import { coverImageUrl } from "@/lib/media";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import { project } from "@commitpass/shared";
import { Brand } from "@/components/landing/brand";
import { Hero } from "@/components/landing/hero";
import { Walkthrough } from "@/components/landing/walkthrough";
import { Poster } from "@/components/landing/poster";
import { Reveal } from "@/components/landing/reveal";
import { LandingSessionGate } from "@/components/landing/session-gate";

const faqs = [
  {
    question: "Is the commitment a ticket price?",
    answer:
      "It’s a refundable deposit to reserve your spot. When your host confirms you attended and the event settles, you can claim it back. Each event sets its own commitment amount and attendance rules.",
  },
  {
    question: "What happens if I don’t show up?",
    answer:
      "If you don’t attend, your commitment is forfeited. Those deposits are shared among the people whose attendance is confirmed, according to the event’s settlement rules. Check the event details before committing.",
  },
  {
    question: "Where do the rewards come from?",
    answer:
      "Rewards can come from forfeited no-show deposits and any net yield earned while the event funds are deposited in a vault. They vary by event and are not guaranteed. Vault strategies also carry risk; the event should explain its terms before you join.",
  },
  {
    question: "Do I need to know anything about crypto?",
    answer:
      "Start with your email and a verification code. CommitPass is being built around familiar sign-in and an embedded wallet powered by Privy, with clear amounts and actions. Sign-in is available now; booking and payment screens are coming next.",
  },
  {
    question: "Can I book an event here yet?",
    answer:
      "Not yet. This is a preview of CommitPass. The contracts are deployed on Monad testnet, while we connect the guest and organizer experience. The event artwork and reservation shown here are examples, not live listings.",
  },
];

export default function Home() {
  return (
    <div id="top">
      <LandingSessionGate />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="/discover">Discover</a>
        </nav>
        <a className="button button--small" href="/signin">
          Sign in <ArrowUpRight size={16} />
        </a>
      </header>
      <main id="main">
        <Hero />
        <div className="promise-strip">
          <span>A spot saved.</span>
          <span className="strip-spark" aria-hidden="true">
            ✳
          </span>
          <span>A promise kept.</span>
          <span className="strip-spark" aria-hidden="true">
            ✳
          </span>
          <span>A little more together.</span>
        </div>
        <Walkthrough />
        <section
          className="host-section"
          id="for-hosts"
          aria-labelledby="host-title"
        >
          <div className="section host-inner">
            <Reveal className="host-art">
              <div className="host-poster">
                <Poster kind="dinner" />
              </div>
              <div className="guest-note">
                <div className="note-header">
                  <span>THE GUEST LIST</span>
                  <span className="sample-label">EXAMPLE</span>
                </div>
                <h3>
                  Set the table.
                  <br />
                  They’re coming.
                </h3>
                <div className="guest-row">
                  <span className="guest-avatar">A</span>
                  <div>
                    Alex<span>Commitment received</span>
                  </div>
                  <Check size={18} />
                </div>
                <div className="guest-row">
                  <span className="guest-avatar guest-avatar--rose">J</span>
                  <div>
                    Jamie<span>Commitment received</span>
                  </div>
                  <Check size={18} />
                </div>
                <div className="note-bottom">
                  <span className="status-dot" /> A little certainty feels good.
                </div>
              </div>
              <span className="handwritten">less chasing, more hosting.</span>
            </Reveal>
            <Reveal className="host-copy">
              <p className="eyebrow">FOR THE PEOPLE BRINGING PEOPLE TOGETHER</p>
              <h2 id="host-title">
                You bring the idea.
                <br />
                <em>
                  They bring the
                  <br className="desktop-break" /> commitment.
                </em>
              </h2>
              <p>
                Empty chairs shouldn’t be part of the plan. Give every RSVP a
                little meaning, so you can focus on making something worth
                showing up for.
              </p>
              <ul className="host-benefits">
                <li>
                  <Check size={18} /> Set a commitment that fits your community.
                </li>
                <li>
                  <Check size={18} /> Confirm who made it, all in one place.
                </li>
                <li>
                  <Check size={18} /> Let the event rules handle the settlement.
                </li>
              </ul>
              <a className="text-link" href="#questions">
                The details, without the fine-print feeling{" "}
                <ArrowUpRight size={17} />
              </a>
            </Reveal>
          </div>
        </section>
        <section
          className="section manifesto"
          aria-labelledby="manifesto-title"
        >
          <Reveal>
            <p className="eyebrow">OFFLINE IS WHERE IT HAPPENS</p>
            <h2 id="manifesto-title">
              The best part of any plan
              <br />
              is <em>the people who show up.</em>
            </h2>
            <p>
              For the first hellos. The one-more-coffees. The “same time next
              week?”s.
              <br className="desktop-break" /> A little commitment can make room
              for a lot more of that.
            </p>
            <div className="community-types">
              <span>Run clubs</span>
              <span>Supper clubs</span>
              <span>Workshops</span>
              <span>Meetups</span>
              <span>Your next good idea</span>
            </div>
            <figure className="community-figure">
              <div className="community-photo">
                <img
                  src={coverImageUrl(brandMedia.workshop.url, 1600)}
                  srcSet={[640, 1200, 1600, 1942]
                    .map(
                      (width) =>
                        `${coverImageUrl(brandMedia.workshop.url, width)} ${width}w`,
                    )
                    .join(", ")}
                  alt="AI-generated illustration of participants collaborating with a facilitator at a hands-on community workshop."
                  width={brandMedia.workshop.width}
                  height={brandMedia.workshop.height}
                  loading="lazy"
                  sizes="(max-width: 599px) calc(100vw - 48px), (max-width: 1160px) calc(100vw - 64px), 1096px"
                />
              </div>
              <figcaption>
                <span>A little time together. A lot to take away.</span>
                <span>Illustrative workshop · AI-generated</span>
              </figcaption>
            </figure>
          </Reveal>
        </section>
        <section
          className="section faq-section"
          id="questions"
          aria-labelledby="faq-title"
        >
          <div>
            <p className="eyebrow">GLAD YOU ASKED</p>
            <h2 id="faq-title">
              A few
              <br />
              <em>good questions.</em>
            </h2>
          </div>
          <div className="faq-list">
            {faqs.map((faq) => (
              <details key={faq.question} name="commitpass-faq">
                <summary>
                  {faq.question}
                  <Plus size={20} aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="closing-area">
        <section className="closing">
          <Reveal>
            <span className="closing-star" aria-hidden="true">
              ✳
            </span>
            <p className="eyebrow">MAKE THE NEXT ONE COUNT</p>
            <h2>
              Less “maybe.”
              <br />
              <em>More memories.</em>
            </h2>
            <a className="button button--dark" href="#how-it-works">
              See how it comes together <ArrowUpRight size={18} />
            </a>
            <p className="closing-note">{project.tagline}</p>
          </Reveal>
        </section>
        <div className="site-footer">
          <Brand compact />
          <span>Made for showing up.</span>
          <div>
            <span className="footer-status">
              <span className="status-dot" /> Built on Monad · Testnet preview
            </span>
            <a
              href="https://github.com/EndPx/commitpass"
              target="_blank"
              rel="noreferrer"
            >
              GitHub <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
