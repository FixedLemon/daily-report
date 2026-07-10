import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Employee } from "@/generated/prisma/client";

// api_specification.md 7章「トークンのリフレッシュ方式」は今後の検討事項のため、
// 本実装ではリフレッシュなしの固定TTL（24時間）とする。
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(employeeId: number): Promise<string> {
  const token = generateSessionToken();
  await prisma.session.create({
    data: {
      token,
      employeeId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

// 有効なBearerトークンからログイン中の社員を解決する。トークンなし・無効・
// 期限切れの場合はnullを返す（呼び出し側でUNAUTHENTICATEDに変換する）。
export async function getAuthenticatedEmployee(
  request: Request,
): Promise<Employee | null> {
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { employee: true },
  });
  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.employee;
}
