export interface EventAppearance {
  style: "minimal" | "aurora" | "confetti" | "grid";
  color: string;
  font: "sans" | "serif" | "mono";
  mode: "light" | "dark";
}

export const DEFAULT_EVENT_APPEARANCE: EventAppearance = {
  style: "minimal",
  color: "#b9462d",
  font: "sans",
  mode: "light",
};

export interface EventMetadata {
  title: string;
  description: string;
  location: string;
  posterUrl: string;
  timezone?: string;
  appearance?: EventAppearance;
}

export interface IndexedEvent {
  id: string;
  chainId: number;
  vault: `0x${string}`;
  eventId: string;
  organizer: string;
  owner: string;
  stakeAmount: string;
  maxParticipant: string;
  registrationDeadline: string;
  startAt: string;
  settleAt?: string | null;
  automation?: string | null;
  status: string;
  registrationClosed: boolean;
  participantCount: number;
  attendeeCount: number;
  rewardPerAttendee: string;
  lastTransaction: string;
}

export interface EventSummary extends IndexedEvent {
  metadata: EventMetadata | null;
  metadataUnavailable: boolean;
}

export interface EventPage {
  data: EventSummary[];
  nextCursor: string | null;
}

export interface IndexedParticipant {
  id: string;
  wallet: string;
  attended: boolean;
  claimed: boolean;
  amount: string;
  claimableAmount: string;
}

export interface ProfileSummary {
  eventsJoined: number;
  eventsHosted: number;
  settledEvents: number;
  eventsAttended: number;
  committedAmount: string;
  claimableAmount: string;
  receivedAmount: string;
  months: Array<{ month: string; events: number }>;
}
export interface ProfilePosition extends IndexedParticipant {
  claimedAmount: string;
  event: EventSummary;
}
export interface ProfilePage {
  source: "envio" | "no-wallets";
  chainId: number;
  summary: ProfileSummary;
  data: ProfilePosition[];
  nextCursor: string | null;
}
