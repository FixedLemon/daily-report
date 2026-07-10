import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { session: { findUnique: vi.fn(), delete: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { GET } = await import("./route");

const employee = {
  id: 101,
  name: "山田太郎",
  email: "sales01@example.com",
  departmentId: 10,
  managerId: 5,
  role: ["SALES"],
};

function meRequest(headers?: Record<string, string>) {
  return new Request("https://example.com/api/auth/me", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/auth/me", () => {
  it("returns the logged-in employee for a valid token", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 1,
      expiresAt: new Date(Date.now() + 60_000),
      employee,
    });

    const res = await GET(meRequest({ authorization: "Bearer valid-token" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: {
        employee_id: 101,
        name: "山田太郎",
        email: "sales01@example.com",
        department_id: 10,
        manager_id: 5,
        role: ["SALES"],
      },
    });
  });

  it("TC-AUTH-03: returns 401 UNAUTHENTICATED when no token is provided", async () => {
    const res = await GET(meRequest());

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHENTICATED");
    expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("TC-AUTH-04: returns 401 UNAUTHENTICATED for a token with no matching session (e.g. after logout)", async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null);

    const res = await GET(meRequest({ authorization: "Bearer revoked-token" }));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 UNAUTHENTICATED for an expired session", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 1,
      expiresAt: new Date(Date.now() - 60_000),
      employee,
    });
    mockPrisma.session.delete.mockResolvedValue({});

    const res = await GET(meRequest({ authorization: "Bearer expired-token" }));

    expect(res.status).toBe(401);
  });
});
