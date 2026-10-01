import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const root = new URL("../", import.meta.url);
const abiDirectory = new URL("contracts/evm/src/abi/", root);
await mkdir(abiDirectory, { recursive: true });
// Export only the methods and events this workflow consumes.
for (const [contract, names] of [
  ["CommitPassFactory", ["getBatch", "isVault", "LifecycleRequested"]],
  ["CommitPassVault", ["getState"]],
]) {
  const abi = JSON.parse(
    await readFile(
      new URL(`../packages/shared/abi/${contract}.json`, root),
      "utf8",
    ),
  );
  await writeFile(
    new URL(`${contract}.abi`, abiDirectory),
    JSON.stringify(
      abi.filter((item) => names.includes(item.name)),
      null,
      2,
    ) + "\n",
  );
}
const result = spawnSync(
  process.platform === "win32" ? "cre.exe" : "cre",
  [
    "generate-bindings",
    "evm",
    "--language",
    "typescript",
    "--abi",
    fileURLToPath(abiDirectory),
    "--project-root",
    fileURLToPath(root),
    "--non-interactive",
  ],
  { cwd: fileURLToPath(root), stdio: "inherit", windowsHide: true },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
if (result.status === 0) {
  for (const contract of ["CommitPassFactory", "CommitPassVault"]) {
    const path = new URL(`contracts/evm/ts/generated/${contract}.ts`, root);
    let source = await readFile(path, "utf8");
    // CLI 1.34 omits type hints for arrays already proven nonempty by its guards.
    // Preserve noUncheckedIndexedAccess in the project without changing runtime logic.
    source = source
      .replace("const f = filters[0]", "const f = filters[0]!")
      .replace("allEncoded[0].map", "allEncoded[0]!.map")
      .replace("t: Hex | Hex[] | null", "t: Hex | Hex[] | null | undefined");
    await writeFile(path, await format(source, { parser: "typescript" }));
  }
}
