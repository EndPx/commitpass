import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../../../", import.meta.url);
await mkdir(new URL("packages/shared/abi/", root), { recursive: true });
for (const name of ["CommitPassFactory", "CommitPassVault"]) {
  const compiled = JSON.parse(
    await readFile(
      new URL(`contracts/out/${name}.sol/${name}.json`, root),
      "utf8",
    ),
  );
  await writeFile(
    new URL(`packages/shared/abi/${name}.json`, root),
    JSON.stringify(compiled.abi, null, 2) + "\n",
  );
}
await import("./export-web-abi.mjs");
