import { NextResponse } from "next/server";
import type { EventMetadata, IndexedEvent } from "@commitpass/shared";
import { ApiError, apiRead, bearer } from "@/lib/server-api";
import { vaultInsights } from "@/lib/server-vault-insights";

const address = /^0x[0-9a-fA-F]{40}$/;
const headers = { "Cache-Control": "no-store" };
type Context = { params: Promise<{ segments?: string[] }> };

async function enrich(event: IndexedEvent) {
  try {
    const metadata = await apiRead<EventMetadata>(
      `/v1/events/${event.vault}/metadata`,
    );
    return { ...event, metadata, metadataUnavailable: false };
  } catch (error) {
    return {
      ...event,
      metadata: null,
      metadataUnavailable: !(error instanceof ApiError && error.status === 404),
    };
  }
}

export async function GET(request: Request, context: Context) {
  try {
    const { segments = [] } = await context.params;
    const query = new URL(request.url).searchParams;
    const after = query.get("after") ?? "";
    if (after.length > 180) throw new ApiError(400);
    const search = new URLSearchParams({ after });
    if (!segments.length) {
      if (query.get("scope") === "mine") {
        const user = await apiRead<{ wallets: string[] }>("/v1/me", {
          token: bearer(request),
        });
        if (
          !Array.isArray(user.wallets) ||
          user.wallets.some((wallet) => !address.test(wallet))
        )
          throw new ApiError(503);
        if (!user.wallets.length)
          return NextResponse.json({ data: [], nextCursor: null }, { headers });
        if (user.wallets.length > 20) throw new ApiError(400);
        search.set("wallets", user.wallets.join(","));
        search.set("role", query.get("role") ?? "all");
      }
      const result = await apiRead<{
        data: IndexedEvent[];
        nextCursor: string | null;
      }>(`/v1/events?${search}`);
      const data = [];
      // Bound concurrent metadata reads to the application pool size.
      for (let index = 0; index < result.data.length; index += 5) {
        data.push(
          ...(await Promise.all(
            result.data.slice(index, index + 5).map(enrich),
          )),
        );
      }
      return NextResponse.json({ ...result, data }, { headers });
    }
    const [vault, resource, wallet] = segments;
    if (!vault || !address.test(vault) || segments.length > 3)
      throw new ApiError(404);
    if (segments.length === 1) {
      const result = await apiRead<{ data: IndexedEvent }>(
        `/v1/events/${vault}`,
      );
      return NextResponse.json(
        { data: await enrich(result.data) },
        { headers },
      );
    }
    if (segments.length === 2 && resource === "vault-insights") {
      return NextResponse.json(await vaultInsights(vault), { headers });
    }
    if (
      resource === "attendance" &&
      wallet &&
      address.test(wallet) &&
      segments.length === 3
    ) {
      const result = await apiRead(`/v1/events/${vault}/attendance/${wallet}`, {
        token: bearer(request),
      });
      return NextResponse.json(result, { headers });
    }
    if (
      wallet ||
      ![
        "metadata",
        "participants",
        "activity",
        "check-ins",
        "guest-profiles",
      ].includes(resource ?? "")
    )
      throw new ApiError(404);
    const result = await apiRead(
      `/v1/events/${vault}/${resource}?${search}`,
      resource === "check-ins" || resource === "guest-profiles"
        ? { token: bearer(request) }
        : {},
    );
    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { segments = [] } = await context.params;
    const [vault, resource, wallet] = segments;
    if (!vault || !address.test(vault)) throw new ApiError(404);
    const metadata = segments.length === 2 && resource === "metadata";
    const checkIn =
      segments.length === 3 &&
      resource === "check-ins" &&
      wallet &&
      address.test(wallet);
    if (!metadata && !checkIn) throw new ApiError(404);
    const token = bearer(request);
    let body: string | undefined;
    if (metadata) {
      if (Number(request.headers.get("content-length") ?? 0) > 32768)
        throw new ApiError(413);
      const reader = request.body?.getReader();
      if (!reader) throw new ApiError(400);
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > 32768) {
          await reader.cancel();
          throw new ApiError(413);
        }
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      body = new TextDecoder().decode(bytes);
    }
    const result = await apiRead(
      `/v1/events/${vault}/${resource}${wallet ? `/${wallet}` : ""}`,
      { method: "PUT", token, body },
    );
    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown) {
  const status =
    error instanceof ApiError &&
    [400, 401, 403, 404, 409, 413].includes(error.status)
      ? error.status
      : 503;
  const message =
    status === 401
      ? "Please sign in again."
      : status === 403
        ? "Only the event owner can do that."
        : status === 404
          ? "This event is not available yet."
          : status === 409
            ? "This action is not available in the event’s current state."
            : status === 400 || status === 413
              ? "Please check your event details."
              : "We couldn’t reach the event service. Please try again.";
  return NextResponse.json({ error: message }, { status, headers });
}
