import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocal } from "@/lib/runtime-network";
import { chainClient } from "@/lib/chain";
import type { Address, Hash } from "viem";
export const dynamic = "force-dynamic";
export default async function LocalReceipt({
  params,
}: {
  params: Promise<{ kind: string; value: string }>;
}) {
  const { kind, value } = await params;
  if (
    !isLocal ||
    !["tx", "address"].includes(kind) ||
    !(kind === "tx" ? /^0x[\da-f]{64}$/i : /^0x[\da-f]{40}$/i).test(value)
  )
    notFound();
  let result: unknown;
  try {
    result =
      kind === "tx"
        ? await chainClient.getTransactionReceipt({ hash: value as Hash })
        : {
            address: value,
            balance: await chainClient.getBalance({
              address: value as Address,
            }),
            hasCode: !!(await chainClient.getBytecode({
              address: value as Address,
            })),
          };
  } catch {
    result = { status: "Not available in the current local run" };
  }
  return (
    <main className="workspace-content" id="workspace-main">
      <Link href="/events">Back to events</Link>
      <h1>Local {kind === "tx" ? "transaction" : "contract"}</h1>
      <p>This receipt belongs to the local Anvil session.</p>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          fontSize: 12,
          marginTop: 24,
        }}
      >
        {JSON.stringify(
          result,
          (_, item) => (typeof item === "bigint" ? item.toString() : item),
          2,
        )}
      </pre>
    </main>
  );
}
