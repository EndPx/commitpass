export interface EventMetadata {
  title: string;
  description: string;
  location: string;
  posterUrl: string;
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
