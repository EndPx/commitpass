import { NextResponse } from "next/server";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (
    !authorization ||
    authorization.length > 16384 ||
    !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization)
  ) {
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401, headers: noStore },
    );
  }
  const apiUrl = process.env.COMMITPASS_API_URL;
  if (!apiUrl) {
    return NextResponse.json(
      { error: "Account service is temporarily unavailable." },
      { status: 503, headers: noStore },
    );
  }
  try {
    const upstream = await fetch(new URL("/v1/session", apiUrl), {
      method: "POST",
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(22000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            upstream.status === 401
              ? "Please sign in again."
              : "Could not connect your account. Please try again.",
        },
        { status: upstream.status === 401 ? 401 : 503, headers: noStore },
      );
    }
    const principal: unknown = await upstream.json();
    if (
      !principal ||
      typeof principal !== "object" ||
      !("id" in principal) ||
      typeof principal.id !== "string"
    )
      throw new Error("Invalid account response");
    const wallets =
      "wallets" in principal && Array.isArray(principal.wallets)
        ? principal.wallets.filter(
            (wallet: unknown): wallet is string =>
              typeof wallet === "string" && /^0x[0-9a-fA-F]{40}$/.test(wallet),
          )
        : [];
    return NextResponse.json(
      {
        id: principal.id,
        wallets,
        name:
          "name" in principal && typeof principal.name === "string"
            ? principal.name
            : "",
        profileCompleted:
          "profileCompleted" in principal &&
          principal.profileCompleted === true,
      },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not connect your account. Please try again." },
      { status: 503, headers: noStore },
    );
  }
}
