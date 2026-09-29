import { NextResponse } from "next/server";
import { ApiError, apiRead, bearer } from "@/lib/server-api";

const headers = { "Cache-Control": "no-store" };

function failure(error: unknown) {
  const status =
    error instanceof ApiError && [400, 401, 409, 413].includes(error.status)
      ? error.status
      : 503;
  return NextResponse.json(
    {
      error:
        status === 409
          ? "A different Mera passkey is already linked to this account."
          : status === 401
            ? "Please sign in again."
            : status === 400 || status === 413
              ? "Invalid passkey metadata."
              : "Could not reach the account service. Please try again.",
    },
    { status, headers },
  );
}

export async function GET(request: Request) {
  try {
    const result = await apiRead("/v1/me/mera-credential", {
      token: bearer(request),
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 2048)
      throw new ApiError(413);
    const reader = request.body?.getReader();
    if (!reader) throw new ApiError(400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 2048) {
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
    const body = new TextDecoder().decode(bytes);
    const result = await apiRead("/v1/me/mera-credential", {
      method: "PUT",
      token: bearer(request),
      body,
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}
