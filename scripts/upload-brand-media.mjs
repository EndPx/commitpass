import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
loadEnvFile(fileURLToPath(new URL("apps/web/.env.local", root)));
const cloud = process.env.CLOUDINARY_CLOUD_NAME;
const key = process.env.CLOUDINARY_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET;
if (!cloud || !key || !secret)
  throw new Error("Cloudinary server configuration is required.");
async function upload(file, publicId) {
  const parameters = {
    overwrite: "false",
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
    transformation: "c_limit,w_2400,h_2400",
  };
  const canonical = Object.keys(parameters)
    .sort()
    .map((name) => `${name}=${parameters[name]}`)
    .join("&");
  const form = new FormData();
  for (const [name, value] of Object.entries(parameters)) form.set(name, value);
  form.set("api_key", key);
  form.set(
    "signature",
    createHash("sha256")
      .update(canonical + secret)
      .digest("hex"),
  );
  form.set(
    "file",
    new Blob([await readFile(new URL(`apps/web/public/brand/${file}`, root))], {
      type: "image/png",
    }),
    file.split("/").at(-1),
  );
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    {
      method: "POST",
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!response.ok)
    throw new Error(`Cloudinary upload returned HTTP ${response.status}.`);
  const result = await response.json();
  if (
    result.public_id !== publicId ||
    !result.secure_url?.startsWith(
      `https://res.cloudinary.com/${cloud}/image/upload/`,
    )
  )
    throw new Error("Unexpected Cloudinary asset response.");
  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}
const workshop = await upload(
  "community-workshop.png",
  "commitpass/brand/community-workshop",
);
const together = await upload(
  "templates/together.png",
  "commitpass/templates/together",
);
const plans = await upload(
  "templates/good-plans.png",
  "commitpass/templates/good-plans",
);
const manifest = {
  workshop,
  templates: [
    { id: "together", name: "Together", category: "Community", ...together },
    { id: "good-plans", name: "Good plans", category: "Creative", ...plans },
    { id: "workshop", name: "Workshop", category: "Workshops", ...workshop },
  ],
};
await writeFile(
  new URL("apps/web/src/lib/brand-media.json", root),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(JSON.stringify(manifest));
