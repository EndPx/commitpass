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
Workspace backgrounds use broad, static pastel gradients: a pale sky wash at
the top and two softer accent-colored washes around the lower edges. Keep the
center quiet for form readability. Derive these colors from the canvas and event
accent (sky 16%, accent 14%/6% in Light; 6%, 24%/12% in Dark). Layer Grid and
Confetti patterns above the same gradient; Aurora adds its existing glow.
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
- Walkthrough: three native buttons with aria-pressed and one preview. Automatically
  advances every 5 seconds while the section is visible, looping from step 3 to 1.
  Changing steps manually resets the timer. Pause/resume control is available;
  automatic changes are not announced by the live region. Timers and the visibility
  observer are cleaned up on unmount.
- FAQ: native details/summary sharing `name="commitpass-faq"` so only one answer
  can be open. Generous tap targets and plus/minus affordance.

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
the caption and alt text identify it as generated. It is hosted on Cloudinary with
lazy loading, responsive sizes, and a fixed aspect-ratio container. Keep the complete desktop
composition; use a centered 4:3 crop on phones. Logo and workshop source prompts
are recorded in `apps/web/public/brand/README.md`.

Hero and closing use clean ivory surfaces with a faint peach radial wash. The
previous watercolor assets remain saved as unused design explorations and are
not requested by the page. The logo and workshop photograph remain in use.
The closing CTA and footer share one `closing-area` background extending to the
page's bottom edge, without a separate solid-color footer strip.

## Sign-in

`/signin` follows the supplied Luma screenshot: a compact centered 380px card,
24px radius, 24px padding, thin border, almost-white surface, and a faint peach
and lavender atmospheric wash behind the lower half of the page. Keep CommitPass
branding and English product copy. Use the same DM Sans family: 24px title,
14px explanation and labels, 16px inputs. Controls are at least 44px tall.
Header links home and back to the landing page's explanation.

Email -> verification code -> authenticated account state. Use Privy headless
email OTP, cooldown for resending, explicit pending/error states, editable email,
and a real backend session verification before reporting a connected account.
Google/passkey buttons are conditional on public feature flags that match the
dashboard; Google was enabled with Privy's default credentials on 28 September
2026, while passkeys remain disabled. Do not show
nonfunctional authentication choices or imply a booking was created by signing in.
Keep Privy in the sign-in route, leaving the public landing bundle independent.
Secrets remain server-side; the browser only receives Privy's public app ID and
sends an SDK-issued bearer token to a same-origin session endpoint.

## Event application

Follow Luma's quiet event workspace and ShowOrSow's date-rail timeline. White/ivory
surfaces, charcoal headings, restrained terracotta selection and light dividers.
Max-width 1040px workspace; 800px event timeline. Header: Events, Discover,
Create event, account menu. No dashboard KPI cards. Empty states use an original
oversized ticket illustration, useful next action, and honest copy.
Account popovers use 16px padding and adjacent 44px action rows with no extra
top margin between My profile and Sign out.

Workspace header follows the supplied Luma reference: 64px desktop / 56px phone,
symbol-only home link at left, centered navigation, local clock and actions at
right. At scrollY <= 8px it is transparent with no visible border or blur. After
scrolling, use 55% ivory, 10px backdrop blur, and a subtle 1px divider. Keep the
border space reserved to prevent layout jumps. Active links use text emphasis,
not an underline. Do not add navigation for unimplemented calendars/notifications.

Routes: `/events` personal upcoming/past with hosting/going filter; `/discover`
public search/list; `/events/[vault]` poster and public event facts, guest commitment
panel; `/events/new` poster preview beside title, date/time, location, description,
commitment and capacity controls. Native date inputs show the device timezone.
Default cover is typographic artwork based on actual title, never a fake listing.
Poster selection colors are local presentation choices; persisted poster URLs must
be HTTPS. Desktop detail/create: 340px cover column + flexible main. Mobile stacks.
All buttons minimum 44px. Empty, loading, unavailable, and not-found are distinct.

Create-page refinement: begin directly with the two-column editor, without visible
breadcrumb, page title, subtitle or testnet badge. Preserve a screen-reader heading.
Cover upload is an icon overlay on the image. Right column: host/public context,
large event-name input, compact start/end date and time rows next to the timezone,
location row, popup description editor, and compact event-option rows.
Registration deadline remains an event option because the contract requires it.
The testnet funding note stays next to the financial action. Keep existing drafts.

Reuse a route-scoped Privy provider for event pages; verified backend session before
personal data or organizer writes. Public indexer data can lag; failed reads never
become empty successes. Financial amounts stay bigint/decimal strings. Use compiled
shared ABIs and deployment metadata. Creation checks the automation workflow before
prompting a wallet; zero workflow ID blocks publishing but permits local drafts.
Transaction receipts, not SDK hashes alone, establish completion. Persist a pending
creation hash with the draft so reload/retry does not deploy duplicate events.
Recover metadata saving after confirmation separately from event creation.
No automatic transactions on page load. This task does not activate the CRE DON.

## Cover uploads

Create/edit event screens use a native file picker styled as Upload cover photo /
Change photo, with pending/error/success states. JPG, PNG, WebP up to 4 MB. Signed-in
users upload through `/api/media`; the server verifies Privy identity through Go,
bounds and checks the file, then signs a Cloudinary upload into an app-specific
user folder. API secrets never enter the browser. Event metadata keeps the HTTPS
delivery URL. Removing a cover detaches it from the draft, not from cloud storage.
Cloudinary cover delivery uses width-specific URLs with automatic quality/format.
Upload feedback uses actual browser-to-server byte progress with a visible bar and
percentage. After transfer, show indeterminate Processing photo until the server
confirms Cloudinary success. Never simulate storage progress or call byte transfer
completion a successful upload. Preparing/processing status remains visible with
reduced motion; failure clears progress and allows retry.

## Popup event editor

Keep only the event title directly editable. Description, location, commitment,
capacity, registration deadline, dates/times, timezone and cover choice open a
dialog with local working values. Confirm commits; Cancel/Escape/backdrop leaves
the draft unchanged. Native dialog supplies modal focus containment and focus
restoration; lock document scroll while open. Inputs remain 44px, dialogs fit the
viewport and scroll internally. Reduced motion removes entrance transitions.
Location opens below its field. When vertical space is limited, scroll the field
above the menu while keeping it below the sticky header, and constrain the menu
to the remaining viewport with internal scrolling. Do not flip it over the form.

Cover gallery offers original generated templates plus Cloudinary upload. A real
hosted cover is selected by default and saved in posterUrl. Do not copy Luma art.
Theme sheet offers Minimal/Aurora/Confetti/Grid, custom accent, Sans/Editorial/Mono,
and Light/Dark. Preview while editing, commit only on Confirm. Store appearance
and IANA timezone in metadata and drafts; use the appearance on event detail.
Shuffle applies a coordinated cover and complete appearance preset together:
background style, accent color, title font, and Light/Dark mode. Choose a different
cover and background style on each click. Manual cover selection keeps the theme.
Convert wall times using Temporal with rejected DST ambiguity before constructing
contract timestamps. Changing timezone preserves instants. Keep commitment >0
and capacity 1–500; do not offer unsupported Free/Unlimited/Approval modes.

## Participant pass and host workspace

Private `/profile` uses the same content width and heading scale as event browsing.
Privy supplies the user's display name; authenticated `/v1/me` supplies wallet
ownership. Envio supplies full-history counts and exact token-unit totals, with
paginated participation records. Attendance rate includes only normally settled
events, excluding cancelled and zero-attendance refunds. Keep wallet balance,
locked commitments, available returns, and received funds visually separate.
Do not sum different assets or label claimable funds as wallet balance. Return
actions open the existing event claim flow, which validates current chain state.
The public commitment asset is native Circle USDC on Monad testnet, with 6
decimals and its address from the shared manifest. All public amounts use USDC
labels. Historical mockAUSD data remains isolated from USDC financial totals;
local Anvil runs use a clearly identified MockUSDC fixture.
Use a quiet four-column financial summary (two on mobile), compact participation
rows, explicit loading/error/empty states, and existing original cover assets.
Add an attendance ring and a six-month registration bar chart. Use full-history
Envio aggregates and exact distinct-event counts; deduplicate multiple linked
wallets at their first event commitment. Calendar buckets use UTC. SVG/CSS marks
are static, with text values and captions, and show honest zero-data states.
The supplied Axis portfolio screenshot informs compact hierarchy: identity and
three metric tiles share a desktop row, followed by Activity/Analytics tabs and
a compact financial strip. Activity is the initial view and its heading/first
rows appear above the fold; charts live under Analytics. Keep the existing light
palette and typography. Remove the settlement explanation beneath the activity.

Header Faucet opens a dialog with fixed USDC/Monad testnet and a verified linked
wallet (prefer Privy's embedded wallet). No wallet means an explicit create-wallet
action, then refresh verification before using its address. Multiple wallets can
be selected. The current Circle form did not honor the tested network/address URL
parameters; show honest instructions, copy the address, and open the official
faucet. Never claim the external form was autofilled or submit a faucet request.

Events and Discover are different browsing surfaces. The supplied Luma events
screenshot is the reference for the personal list: a 900px content measure,
32px heading with Upcoming/Past on the same row, grouped calendar dates at left,
a dotted timeline rail, quiet white cards with 16px padding and 112px square
posters at right. Event title is 20px; host/location/time are 14px. Dates are
grouped in the viewer's timezone. Personal badges use only the verified role
and indexed lifecycle state; guest counts use participantCount. No invented
approval states, profile photos, attendee faces, or live example events.

Events and Discover share the same 900px content measure, 32px heading, top
spacing, and Upcoming/Past control. Desktop app navigation aligns with that
content's left edge; both links have equal visual weight and active state rules.
Reserve a stable document scrollbar gutter so switching between short and long
pages preserves horizontal alignment. Header tracks use container width.
Discover has one compact toolbar: a search input, an event count, and Filters.
Format, Next 7 days, and open-spot options live in a dismissible filter popover.
No subtitle, duplicate host action, or extra results heading above the events.
Discover uses a responsive three/two/one-column poster grid. Search filters loaded
event titles and locations, with pagination still available. Reset is present
when filters produce no matches. Both routes share the same restrained empty
state structure, explicitly describing the missing events and a relevant action. Document
scroll owns both routes; the existing header remains sticky. Mobile timelines
place dates above cards, use 84px posters, and keep all controls reachable at
44px minimum height. Cards wrap long titles and locations without overflow.
Skeletons follow the final geometry; failed reads keep a visible retry action.
The discovery grid follows the [StyleGallery card-grid pattern](https://github.com/changeroa/StyleGallery/blob/main/patterns/grid-repetition/card-grid.md):
repeating media cards share column tracks and use document scrolling rather than
independent scrolling panels.

Event detail keeps the cover/host column and editorial title, dates, venue/map,
reservation panel and description. Read current contract state before offering
financial actions. Indexed data supplies discovery/history; failed refreshes have
explicit feedback. A confirmed depositor sees a ticket with reservation QR, check-in
status, downloadable pass and calendar action. The QR contains only event/wallet
references, never an authentication credential or attendance proof.

The /manage route is the host workspace: compact guest/commitment/status summary,
registration/start/settled progress, explicit Start/End confirmation, guest search,
check-in and metadata editing. Reuse warm canvas, accent, typography and themes.
Mobile stacks ticket QR and summary columns. Owner authorization comes from fresh
chain state and Privy; the API independently authorizes every check-in/metadata write.
Lifecycle requests remain pending until CRE execution changes contract state.
