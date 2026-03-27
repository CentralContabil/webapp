import * as jose from "jose";
import type { Env } from "./env.js";

export type DownloadTool = "nfe" | "sped";

export async function signDownloadToken(
  env: Env,
  jobId: string,
  fileName: string,
  tool: DownloadTool = "nfe"
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new jose.SignJWT({ jobId, fileName, tool })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyDownloadToken(
  env: Env,
  token: string
): Promise<{ jobId: string; fileName: string; tool: DownloadTool } | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    const jobId = payload.jobId;
    const fileName = payload.fileName;
    const rawTool = payload.tool;
    if (typeof jobId !== "string" || typeof fileName !== "string") return null;
    const tool: DownloadTool = rawTool === "sped" ? "sped" : "nfe";
    return { jobId, fileName, tool };
  } catch {
    return null;
  }
}
