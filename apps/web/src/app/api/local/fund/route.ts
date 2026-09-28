import { NextResponse } from "next/server";
import { apiRead, bearer, ApiError } from "@/lib/server-api";
import { isLocal } from "@/lib/runtime-network";

export async function POST(request: Request) {
  if (
    !isLocal ||
    process.env.COMMITPASS_LOCAL !== "1" ||
    !process.env.COMMITPASS_LOCAL_CONTROL_TOKEN
  )
    return new Response(null, { status: 404 });
  try {
    const user = await apiRead<{ wallets: string[] }>("/v1/me", {
      token: bearer(request),
    });
    const reader = request.body?.getReader();
    if (!reader) throw new ApiError(400);
    let body = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      body += new TextDecoder().decode(chunk.value);
      if (body.length > 256) {
        await reader.cancel();
        throw new ApiError(400);
      }
    }
    const value = JSON.parse(body);
    if (
      typeof value.wallet !== "string" ||
      !/^0x[0-9a-fA-F]{40}$/.test(value.wallet) ||
      !user.wallets.some(
        (address) => address.toLowerCase() === value.wallet.toLowerCase(),
      )
    )
      throw new ApiError(403);
    const response = await fetch("http://127.0.0.1:8092/fund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.COMMITPASS_LOCAL_CONTROL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ wallet: value.wallet }),
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    if (!response.ok) throw new ApiError(503);
    return NextResponse.json(
      { funded: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 503;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Sign in to get local test funds."
            : status === 403
              ? "Use a wallet linked to your account."
              : "Local funding is unavailable. Check the local runtime.",
      },
      { status },
    );
  }
}
