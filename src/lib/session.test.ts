import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    session: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const {
  createSession,
  deleteSession,
  extractBearerToken,
  generateSessionToken,
  getAuthenticatedEmployee,
} = await import("./session");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateSessionToken", () => {
  it("generates a sufficiently long random hex token", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(generateSessionToken()).not.toBe(token);
  });
});

describe("extractBearerToken", () => {
  it("extracts the token from a Bearer authorization header", () => {
    const request = new Request("https://example.com", {
      headers: { authorization: "Bearer abc123" },
    });
    expect(extractBearerToken(request)).toBe("abc123");
  });

  it("returns null when the authorization header is missing", () => {
    const request = new Request("https://example.com");
    expect(extractBearerToken(request)).toBeNull();
  });

  it("returns null when the header does not use the Bearer scheme", () => {
    const request = new Request("https://example.com", {
      headers: { authorization: "Basic abc123" },
    });
    expect(extractBearerToken(request)).toBeNull();
  });
});

describe("createSession", () => {
  it("persists a new session token for the given employee", async () => {
    mockPrisma.session.create.mockResolvedValue({});
    const token = await createSession(101);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(mockPrisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ token, employeeId: 101 }),
      }),
    );
  });
});

describe("deleteSession", () => {
  it("deletes the session matching the given token", async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
    await deleteSession("some-token");
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
      where: { token: "some-token" },
    });
  });
});

describe("getAuthenticatedEmployee", () => {
  it("returns null when no token is present", async () => {
    const request = new Request("https://example.com");
    expect(await getAuthenticatedEmployee(request)).toBeNull();
    expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the token does not match any session", async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null);
    const request = new Request("https://example.com", {
      headers: { authorization: "Bearer missing-token" },
    });
    expect(await getAuthenticatedEmployee(request)).toBeNull();
  });

  it("returns the employee for a valid, unexpired session", async () => {
    const employee = { id: 101, name: "山田太郎" };
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 1,
      expiresAt: new Date(Date.now() + 60_000),
      employee,
    });
    const request = new Request("https://example.com", {
      headers: { authorization: "Bearer valid-token" },
    });
    expect(await getAuthenticatedEmployee(request)).toBe(employee);
  });

  it("deletes and returns null for an expired session (TC-AUTH-04)", async () => {
    const employee = { id: 101, name: "山田太郎" };
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 1,
      expiresAt: new Date(Date.now() - 60_000),
      employee,
    });
    mockPrisma.session.delete.mockResolvedValue({});
    const request = new Request("https://example.com", {
      headers: { authorization: "Bearer expired-token" },
    });
    expect(await getAuthenticatedEmployee(request)).toBeNull();
    expect(mockPrisma.session.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
