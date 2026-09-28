# CommitPass web design

## 0. Reference observations

Observed on 28 September 2026: [Luma](https://luma.com/) uses a centered 80px,
medium-weight headline, generous whitespace, colorful rotated event posters,
soft paper-like frames, and compact pill controls. [Crafts](https://crafts.dev/)
uses an approximately 83px headline with -3.7px tracking; scattered objects
resolve into one centered card during scroll. These are composition and motion
references, not sources for branding or marketing claims.

[ShowOrSow](https://github.com/EndPx/ShowOrSow/tree/20c85e57c2044942b157c704461150283e429ef1/web)
informs event-first copy, refundable RSVP explanations, and an interactive
walkthrough. Its Canton privacy and instant payout claims do not apply here.
All poster illustrations in this implementation are original CSS/SVG artwork.

## 1. Atmosphere and identity

Warm, social, editorial. The audience is a guest organizing their weekend or a
small community host managing turnout. Communicate events before infrastructure.
The memorable gesture is a constellation of posters gathering into a reservation.
The surrounding page stays quiet. Never invent live events, users, or testimonials.

## 2. Color tokens

Canvas #faf9f6; white #ffffff; ink #252622; muted #686963; border #e5e5de;
accent #b9462d; accent-soft #fae6db; green #315c45; green-soft #e5eee4.
Poster-only inks/papers: #ec6848, #fae0b1, #dceb8c, #235443, #ccd9ee,
#334b86, #efb8c4, #743345, #dcc8b9, #6c422e. Posters may use derived
transparent shades for artwork. Core text always uses contrast-safe ink.

## 3. Typography

DM Sans variable for interface, headings and body; DM Serif Display italic for
short emotional emphasis and selected posters. Fonts are self-hosted by Next.
Type scale: 12, 13, 14, 16, 18, 20, 24, 32, 40, 56, 80, 96px. Hero fluid
48–96px, tracking -0.065em, line-height 1.02. Section headings 36–64px.
Body 16–18px, line-height 1.65. Eyebrows 12px with 0.12em tracking.

## 4. Spacing and layout

4px base; 8/12/16/24/32/48/64/96/128px rhythm. Max content width 1160px.
Native document scrolling owns the page; no smooth-scroll replacement. Header
height 80px desktop, 68px mobile. Sticky at top:0, z-index 50, ivory at 58%
opacity with 16px backdrop blur. Anchor offsets clear the header: 104px desktop,
92px mobile. Hero pin begins 80px below the viewport top so it stays beneath
the navigation. Section spacing 112px desktop, 72px mobile.
Breakpoints: 600px, 900px, 1200px. Pin only at >=900px and height >=700px.
Mobile receives a static poster arrangement and normal document flow.

## 5. Reusable components

- Brand: GPT Image-generated terracotta C and check symbol, paired with a live
  text wordmark. Transparent PNG served through Next Image; also the favicon.
  Home link has an accessible name.
- Button/link: 48px minimum height, pill, dark solid or quiet outline. Hover lift
  2px; press returns to baseline; 3px visible focus ring. Real destination required.
- Event poster: framed artwork, original typography and graphical motifs. Entirely
  decorative in hero; sample event label wherever used as a product illustration.
- Eyebrow: uppercase small section identifier; never the sole explanation.
- Reservation: poster thumbnail, event label, amount, check-in state, refund state.
  Mock preview is explicitly labeled; no wallet call or fake transaction receipt.
- Walkthrough: three native buttons with aria-pressed and one live preview.
- FAQ: native details/summary, generous tap target, plus/minus affordance.

## 6. Motion and interaction

GSAP + ScrollTrigger + useGSAP scoped cleanup. One pinned timeline: headline
fades/lifts, six posters move toward the center and shrink, reservation appears.
Scroll distance ~110% viewport, scrub 0.8. Each poster has a separate inner wrapper
with a gentle 12px vertical idle float over 7–8.5 seconds. Different negative
delays keep the motion out of phase. CSS animates the inner wrapper; GSAP owns
the outer wrapper so idle and scroll transforms never overwrite each other.
Below-fold reveals: y24px, opacity, 650ms power2.out, once per section.
Button transitions 180ms. Reduced motion removes idle float, pinning, parallax and reveals;
all essential text and walkthrough controls remain available. Rendered server
content is visible before JavaScript. No loader or forced waiting screen.

## 7. Depth and surfaces

Only posters and reservation previews have broad low-opacity layered shadows.
Content sections use whitespace and occasional 1px dividers. Slight warm radial
light behind hero artwork. Avoid generic repeated feature-card grids.

## 8. Accessibility and scope

Semantic landmarks, skip link, one h1, keyboard controls, native FAQ, 44px touch
targets, focus outlines, decorative art hidden from assistive technology.
No essential information is available only through motion or hover.
This is a landing page and illustrative walkthrough. Privy onboarding, event
discovery and transactions are subsequent work. All calls to action have working
section anchors. No automated tests or Lighthouse audit requested for this task;
do not claim measured scores. Development tooling stays development-only.

## Generated imagery

The community section includes a panoramic GPT Image-generated workshop scene,
with warm daylight, a facilitator, laptops, and people collaborating. It is an
illustration of the intended experience, not evidence of a real CommitPass event;
the caption and alt text identify it as generated. Use Next Image lazy loading,
responsive sizes, and a fixed aspect-ratio container. Keep the complete desktop
composition; use a centered 4:3 crop on phones. Logo and workshop source prompts
are recorded in `apps/web/public/brand/README.md`.

Hero and closing use clean ivory surfaces with a faint peach radial wash. The
previous watercolor assets remain saved as unused design explorations and are
not requested by the page. The logo and workshop photograph remain in use.
The closing CTA and footer share one `closing-area` background extending to the
page's bottom edge, without a separate solid-color footer strip.
