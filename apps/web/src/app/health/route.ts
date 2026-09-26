import { project } from "@commitpass/shared";

export function GET() {
  return Response.json({ status: "ok", service: "web", project });
}
