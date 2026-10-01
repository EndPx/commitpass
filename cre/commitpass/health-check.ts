import {
  CronCapability,
  HTTPClient,
  Runner,
  consensusIdenticalAggregation,
  handler,
  json,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";
import { z } from "zod";
import { apiUrlSchema } from "./config";

const configSchema = z
  .object({
    mode: z.literal("local-simulation"),
    attendanceApi: apiUrlSchema,
  })
  .strict();
type Config = z.infer<typeof configSchema>;

const fetchHealth = (sender: HTTPSendRequester, apiUrl: string): string => {
  const response = sender
    .sendRequest({ url: `${apiUrl.replace(/\/$/, "")}/health`, method: "GET" })
    .result();
  if (response.statusCode !== 200 || response.body.length > 64_000)
    throw new Error("Attendance API unavailable");
  z.object({ status: z.literal("ok") })
    .passthrough()
    .parse(json(response));
  return "ok";
};

const onCronTrigger = (runtime: Runtime<Config>): string => {
  const status = new HTTPClient()
    .sendRequest(
      runtime,
      fetchHealth,
      consensusIdenticalAggregation<string>(),
    )(runtime.config.attendanceApi)
    .result();
  // This entry point never constructs an EVM client, report or signer.
  return JSON.stringify({
    mode: "local-simulation",
    attendanceApi: status,
    wouldWrite: false,
  });
};

const initWorkflow = () => [
  handler(
    new CronCapability().trigger({ schedule: "0 * * * * *" }),
    onCronTrigger,
  ),
];

export async function main() {
  const runner = await Runner.newRunner({ configSchema });
  await runner.run(initWorkflow);
}

main();
