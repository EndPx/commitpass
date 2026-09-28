import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, apiRead, bearer } from "@/lib/server-api";
import { MAX_COVER_BYTES } from "@/lib/media";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = MAX_COVER_BYTES + 65536;

export async function POST(request: Request) {
  try {
    const user = await apiRead<{ id: string }>("/v1/me", {
      token: bearer(request),
    });
    if (typeof user.id !== "string" || !user.id.startsWith("did:privy:"))
      throw new ApiError(401);
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !/^[a-z0-9_-]+$/i.test(cloud) || !apiKey || !secret)
      throw new ApiError(503);

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data;"))
      throw new ApiError(415);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
      throw new ApiError(413);
    const reader = request.body?.getReader();
    if (!reader) throw new ApiError(400);
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413);
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let form: FormData;
    try {
      form = await new Response(bytes, {
        headers: { "Content-Type": contentType },
      }).formData();
    } catch {
      throw new ApiError(400);
    }
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      form.getAll("file").length !== 1
    )
      throw new ApiError(400);
    if (file.size > MAX_COVER_BYTES) throw new ApiError(413);
    const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => signature[index] === byte,
    );
    const jpeg =
      signature[0] === 255 && signature[1] === 216 && signature[2] === 255;
    const webp =
      new TextDecoder().decode(signature.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(signature.slice(8, 12)) === "WEBP";
    if (!png && !jpeg && !webp) throw new ApiError(415);

    const owner = createHash("sha256")
      .update(user.id)
      .digest("hex")
      .slice(0, 24);
    const publicId = `commitpass/event-covers/${owner}/${randomUUID()}`;
    const parameters: Record<string, string> = {
      allowed_formats: "jpg,jpeg,png,webp",
      overwrite: "false",
      public_id: publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
      transformation: "c_limit,w_2400,h_2400",
    };
    const canonical = Object.keys(parameters)
      .sort()
      .map((key) => `${key}=${parameters[key]}`)
      .join("&");
    const upload = new FormData();
    for (const [key, value] of Object.entries(parameters))
      upload.set(key, value);
    upload.set("api_key", apiKey);
    upload.set(
      "signature",
      createHash("sha256")
        .update(canonical + secret)
        .digest("hex"),
    );
    upload.set("file", file, `cover.${png ? "png" : webp ? "webp" : "jpg"}`);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
      {
        method: "POST",
        body: upload,
        redirect: "error",
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok) throw new ApiError(response.status === 400 ? 415 : 503);
    const result = await response.json();
    const url = new URL(result.secure_url);
    if (
      result.public_id !== publicId ||
      result.resource_type !== "image" ||
      url.protocol !== "https:" ||
      url.hostname !== "res.cloudinary.com" ||
      !url.pathname.startsWith(`/${cloud}/image/upload/`)
    )
      throw new ApiError(503);
    return NextResponse.json(
      {
        url: url.toString(),
        publicId,
        width: result.width,
        height: result.height,
      },
      { headers },
    );
  } catch (error) {
    const status =
      error instanceof ApiError && [400, 401, 413, 415].includes(error.status)
        ? error.status
        : 503;
    const message =
      status === 401
        ? "Please sign in to upload a photo."
        : status === 413
          ? "Choose an image smaller than 4 MB."
          : status === 415
            ? "Choose a valid JPG, PNG, or WebP image."
            : status === 400
              ? "Please choose one image to upload."
              : "Photo upload is temporarily unavailable. Please try again.";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
