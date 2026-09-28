"use client";

import { useState } from "react";
import { ArrowRight, Check, MapPin, Ticket, Wallet } from "lucide-react";
import { Poster } from "./poster";

const steps = [
  {
    title: "Find your people.",
    body: "A run club, a workshop, a dinner with strangers. Save your spot with a small, refundable commitment.",
  },
  {
    title: "Make it out the door.",
    body: "Be there for the people who planned it. Check in at the event and let your host confirm your attendance.",
  },
  {
    title: "Good things come back.",
    body: "After the event settles, claim your commitment back—plus your share of any no-show deposits and available rewards.",
  },
];

export function Walkthrough() {
  const [step, setStep] = useState(0);
  return (
    <section
      className="section walkthrough"
      id="how-it-works"
      aria-labelledby="how-title"
    >
      <div className="walkthrough-copy">
        <p className="eyebrow">A BETTER KIND OF RSVP</p>
        <h2 id="how-title">
          A small promise.
          <br />
          <em>A real connection.</em>
        </h2>
        <div className="step-list">
          {steps.map((item, index) => (
            <button
              type="button"
              key={item.title}
              className={`step-button${index === step ? " is-active" : ""}`}
              onClick={() => setStep(index)}
              aria-pressed={index === step}
              aria-controls="reservation-preview"
            >
              <span className="step-number">0{index + 1}</span>
              <span>
                <strong>{item.title}</strong>
                <span className="step-description">{item.body}</span>
              </span>
              <ArrowRight className="step-arrow" size={18} />
            </button>
          ))}
        </div>
      </div>
      <div className="walkthrough-art">
        <div className="preview-orbit orbit-one" />
        <div className="preview-orbit orbit-two" />
        <div className="reservation" id="reservation-preview">
          <div className="reservation-top">
            <span className="mini-brand">commitpass.</span>
            <span className="sample-label">INTERACTIVE PREVIEW</span>
          </div>
          <div className="reservation-image">
            <Poster kind="run" compact />
            <div className="reservation-date">
              <span>SUN</span>
              <strong>12</strong>
            </div>
          </div>
          <div className="reservation-content">
            <span className="event-type">
              A LITTLE FRESH AIR, A LOT OF GOOD COMPANY
            </span>
            <h3>Sunday Slow Run</h3>
            <p className="event-location">
              <MapPin size={15} /> Jakarta · 7:00 AM
            </p>
            <div
              className="reservation-state"
              aria-live="polite"
              aria-atomic="true"
              key={step}
            >
              <span className={`state-icon state-icon--${step}`}>
                {step === 0 ? (
                  <Ticket size={22} />
                ) : step === 1 ? (
                  <Check size={22} />
                ) : (
                  <Wallet size={22} />
                )}
              </span>
              <strong>
                {step === 0
                  ? "Your spot. Your promise."
                  : step === 1
                    ? "You made it!"
                    : "Your commitment, returned."}
              </strong>
              <p>
                {step === 0
                  ? "$5 refundable commitment"
                  : step === 1
                    ? "Attendance confirmed by your host"
                    : "$5 commitment + any eligible reward"}
              </p>
              <span className="state-footnote">
                {step === 0
                  ? "Show up to become eligible for a refund."
                  : step === 1
                    ? "Next up: the event closes and settles."
                    : "Available to claim after settlement."}
              </span>
            </div>
            <button
              className="preview-button"
              onClick={() => setStep((current) => (current + 1) % steps.length)}
              type="button"
            >
              {step === 0
                ? "Preview check-in"
                : step === 1
                  ? "Preview settlement"
                  : "Start again"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <p className="preview-caption">
          An example of the journey. No payment is made.
        </p>
      </div>
    </section>
  );
}
