import * as jose from "jose";
import type { Env } from "./env.js";

export async function signDownloadToken(
  env: Env,
  jobId: string,
  fileName: string
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new jose.SignJWT({ jobId, fileName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyDownloadToken(
  env: Env,
  token: string
): Promise<{ jobId: string; fileName: string } | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    const jobId = payload.jobId;
    const fileName = payload.fileName;
    if (typeof jobId !== "string" || typeof fileName !== "string") return null;
    return { jobId, fileName };
  } catch {
    return null;
  }
}
