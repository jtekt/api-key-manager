import { randomBytes } from "crypto";
import * as argon2 from "argon2";

// TODO: env parsing with zod

const argon2Opts: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 65536),
  timeCost: Number(process.env.ARGON2_TIME_COST ?? 3),
  parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
};

function applyPepper(plaintext: string): string {
  const pepper = process.env.KEY_PEPPER;
  return pepper ? plaintext + pepper : plaintext;
}

export function generateApiKey(): { plaintext: string; hint: string } {
  const plaintext = "ak_" + randomBytes(32).toString("base64url");
  return { plaintext, hint: plaintext.slice(0, 8) };
}

export async function hashKey(plaintext: string): Promise<string> {
  return argon2.hash(applyPepper(plaintext), argon2Opts);
}

export async function verifyKey(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return argon2.verify(hash, applyPepper(plaintext));
}
