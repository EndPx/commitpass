export const MAX_COVER_BYTES = 4 * 1024 * 1024;
export const COVER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Transform only this app's Cloudinary images; preserve other HTTPS poster URLs. */
export function coverImageUrl(value: string, width: number) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "res.cloudinary.com" ||
      !url.pathname.startsWith("/dnzjmihyx/image/upload/") ||
      !url.pathname.includes("/commitpass/")
    )
      return value;
    url.pathname = url.pathname.replace(
      "/image/upload/",
      `/image/upload/f_auto,q_auto,c_limit,w_${width}/`,
    );
    return url.toString();
  } catch {
    return value;
  }
}
