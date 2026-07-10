import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { session: { deleteMany: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { POST } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/logout", () => {
  it("TC-AUTH-04: deletes the session for the given token and returns 204", async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      new Request("https://example.com/api/auth/logout", {
        method: "POST",
        headers: { authorization: "Bearer some-token" },
      }),
    );

    expect(res.status).toBe(204);
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
      where: { token: "some-token" },
    });
  });

  it("returns 204 without touching the session store when no token is present", async () => {
    const res = await POST(
      new Request("https://example.com/api/auth/logout", { method: "POST" }),
    );

    expect(res.status).toBe(204);
    expect(mockPrisma.session.deleteMany).not.toHaveBeenCalled();
  });
});
