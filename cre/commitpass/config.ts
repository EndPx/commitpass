import { getAddress, zeroAddress } from "viem";
import { z } from "zod";

export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => getAddress(value));
export const uint256Schema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .refine((value) => BigInt(value) < 2n ** 256n);
export const hashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
// The CRE QuickJS runtime has no global URL constructor.
export const apiUrlSchema = z
  .string()
  .regex(
    /^(https:\/\/[a-zA-Z0-9.-]+|http:\/\/(127\.0\.0\.1|localhost))(:[1-9]\d{0,4})?(\/[a-zA-Z0-9_./~-]*)?$/,
    "Use an HTTPS API base URL, or HTTP loopback for local simulation",
  );

export const configSchema = z
  .object({
    schedule: z.string().min(1).default("0 * * * * *"),
    factory: addressSchema.refine(
      (value) => value !== zeroAddress,
      "Configure the event factory",
    ),
    attendanceApi: apiUrlSchema,
    attendanceSecretId: z.string().min(1),
    gasLimit: z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .refine(
        (value) => BigInt(value) <= 10_000_000n,
        "Gas limit exceeds the CRE per-write limit",
      ),
    simulationSigningSecretId: z.string().min(1).optional(),
  })
  .strict();

export type Config = z.infer<typeof configSchema>;
