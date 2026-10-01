import {
  HTTPClient,
  consensusIdenticalAggregation,
  json,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, getAddress, keccak256, type Address } from "viem";
import { z } from "zod";
import {
  MONAD_TESTNET,
  snapshotParameters,
  type AttendanceSnapshot,
} from "@commitpass/shared";
import {
  addressSchema,
  uint256Schema,
  hashSchema,
  type Config,
} from "./config";

const snapshotSchema = z
  .object({
    version: z.literal(1),
    chainId: uint256Schema,
    vault: addressSchema,
    eventId: uint256Schema,
    cutoff: uint256Schema,
    frozen: z.literal(true),
    attendees: z.array(addressSchema).max(500),
    snapshotHash: hashSchema,
  })
  .strict();

function fetchSnapshot(
  requester: HTTPSendRequester,
  url: string,
  token: string,
): string {
  const response = requester
    .sendRequest({
      url,
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cacheSettings: { store: false },
    })
    .result();
  if (response.statusCode !== 200)
    throw new Error(
      `Attendance API status ${response.statusCode}; settlement deferred`,
    );
  if (response.body.length > 64_000)
    throw new Error("Attendance response too large");
  const parsed = snapshotSchema.parse(json(response));
  // Each node agrees on the validated snapshot, with stable key order.
  return JSON.stringify(parsed);
}

export function getAttendanceSnapshot(
  runtime: Runtime<Config>,
  vault: Address,
  eventId: bigint,
  cutoff: bigint,
) {
  const token = runtime
    .getSecret({ id: runtime.config.attendanceSecretId })
    .result().value;
  const url = `${runtime.config.attendanceApi.replace(/\/$/, "")}/v1/attendance-snapshots/${MONAD_TESTNET.chainId}/${vault}/${eventId}/${cutoff}`;
  const encoded = new HTTPClient()
    .sendRequest(
      runtime,
      fetchSnapshot,
      consensusIdenticalAggregation<string>(),
    )(url, token)
    .result();
  const snapshot = JSON.parse(encoded) as AttendanceSnapshot;
  if (
    BigInt(snapshot.chainId) !== BigInt(MONAD_TESTNET.chainId) ||
    snapshot.vault !== vault ||
    BigInt(snapshot.eventId) !== eventId ||
    BigInt(snapshot.cutoff) !== cutoff
  ) {
    throw new Error(
      "Attendance snapshot belongs to a different event or cutoff",
    );
  }
  let previous = 0n;
  for (const attendee of snapshot.attendees) {
    if (BigInt(attendee) <= previous)
      throw new Error("Attendance must be sorted and unique");
    previous = BigInt(attendee);
  }
  const digest = keccak256(
    encodeAbiParameters(snapshotParameters, [
      BigInt(MONAD_TESTNET.chainId),
      vault,
      eventId,
      cutoff,
      snapshot.attendees,
    ]),
  );
  if (digest !== snapshot.snapshotHash.toLowerCase())
    throw new Error("Attendance snapshot hash mismatch");
  return { attendees: snapshot.attendees, hash: digest };
}
