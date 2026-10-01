import { NextResponse } from "next/server";
import type {
  EventMetadata,
  IndexedEvent,
  ProfilePage,
  ProfilePosition,
  ProfileSummary,
} from "@commitpass/shared";
import { ApiError, apiRead, bearer } from "@/lib/server-api";

const headers = { "Cache-Control": "private, no-store" };
const address = /^0x[0-9a-fA-F]{40}$/;
export async function PUT(request: Request) {
  try {
    const token = bearer(request);
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("name" in body) ||
      typeof body.name !== "string" ||
      [...body.name.trim()].length < 2 ||
      [...body.name.trim()].length > 60
    )
      throw new ApiError(400);
    const result = await apiRead("/v1/me", {
      token,
      method: "PUT",
      body: JSON.stringify({ name: body.name.trim() }),
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    const status =
      error instanceof ApiError && [400, 401].includes(error.status)
        ? error.status
        : 503;
    return NextResponse.json(
      {
        error:
          status === 400
            ? "Choose a name with 2 to 60 characters."
            : status === 401
              ? "Please sign in again."
              : "We couldn’t save your name. Please try again.",
      },
      { status, headers },
    );
  }
}
export async function GET(request: Request) {
  try {
    const user = await apiRead<{ wallets: string[] }>("/v1/me", {
      token: bearer(request),
    });
    if (
      !Array.isArray(user.wallets) ||
      user.wallets.length > 20 ||
      user.wallets.some((wallet) => !address.test(wallet))
    )
      throw new ApiError(503);
    const query = new URL(request.url).searchParams;
    const after = query.get("after") ?? "";
    const kind = query.get("kind") ?? "all";
    if (after.length > 180 || !["all", "claimable", "received"].includes(kind))
      throw new ApiError(400);
    if (!user.wallets.length)
      return NextResponse.json(
        {
          source: "no-wallets",
          chainId: 10143,
          summary: {
            eventsJoined: 0,
            eventsHosted: 0,
            settledEvents: 0,
            eventsAttended: 0,
            committedAmount: "0",
            claimableAmount: "0",
            receivedAmount: "0",
            months: [],
          },
          data: [],
          nextCursor: null,
        } satisfies ProfilePage,
        { headers },
      );
    const wallets = new URLSearchParams({ wallets: user.wallets.join(",") });
    const positions = new URLSearchParams(wallets);
    positions.set("after", after);
    positions.set("kind", kind);
    const [summary, result] = await Promise.all([
      apiRead<{ data: ProfileSummary }>(`/v1/wallet-profile?${wallets}`),
      apiRead<{
        data: Array<Omit<ProfilePosition, "event"> & { event: IndexedEvent }>;
        nextCursor: string | null;
      }>(`/v1/wallet-positions?${positions}`),
    ]);
    const data: ProfilePosition[] = [];
    for (let index = 0; index < result.data.length; index += 5) {
      data.push(
        ...(await Promise.all(
          result.data.slice(index, index + 5).map(async (row) => {
            let metadata: EventMetadata | null = null;
            let metadataUnavailable = false;
            try {
              metadata = await apiRead<EventMetadata>(
                `/v1/events/${row.event.vault}/metadata`,
              );
            } catch (error) {
              metadataUnavailable = !(
                error instanceof ApiError && error.status === 404
              );
            }
            return {
              ...row,
              event: { ...row.event, metadata, metadataUnavailable },
            };
          }),
        )),
      );
    }
    return NextResponse.json(
      {
        source: "envio",
        chainId: 10143,
        summary: summary.data,
        data,
        nextCursor: result.nextCursor,
      } satisfies ProfilePage,
      { headers },
    );
  } catch (error) {
    const status =
      error instanceof ApiError && [400, 401, 403].includes(error.status)
        ? error.status
        : 503;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Please sign in again."
            : status === 400
              ? "Please check your profile filters."
              : "We couldn’t load your activity. Please try again.",
      },
      { status, headers },
    );
  }
}
