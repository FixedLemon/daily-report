import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockVerifyPassword, mockCreateSession } = vi.hoisted(() => ({
  mockPrisma: { employee: { findUnique: vi.fn() } },
  mockVerifyPassword: vi.fn(),
  mockCreateSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/password", () => ({
  verifyPassword: mockVerifyPassword,
  hashPassword: vi.fn(() => "unused-hash"),
}));
vi.mock("@/lib/session", () => ({ createSession: mockCreateSession }));

const { POST } = await import("./route");

function loginRequest(body: unknown) {
  return new Request("https://example.com/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const employee = {
  id: 101,
  name: "山田太郎",
  email: "sales01@example.com",
  passwordHash: "stored-hash",
  departmentId: 10,
  managerId: 5,
  role: ["SALES"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/login", () => {
  it("TC-AUTH-01: returns a token and employee info for correct credentials", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(employee);
    mockVerifyPassword.mockReturnValue(true);
    mockCreateSession.mockResolvedValue("issued-token");

    const res = await POST(
      loginRequest({ email: "sales01@example.com", password: "correct-password" }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: {
        token: "issued-token",
        employee: {
          employee_id: 101,
          name: "山田太郎",
          email: "sales01@example.com",
          department_id: 10,
          manager_id: 5,
          role: ["SALES"],
        },
      },
    });
  });

  it("TC-AUTH-02: returns 401 UNAUTHENTICATED for an incorrect password", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(employee);
    mockVerifyPassword.mockReturnValue(false);

    const res = await POST(
      loginRequest({ email: "sales01@example.com", password: "wrong-password" }),
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHENTICATED");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("returns 401 UNAUTHENTICATED when the email does not exist", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(null);

    const res = await POST(
      loginRequest({ email: "nobody@example.com", password: "whatever" }),
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 400 VALIDATION_ERROR when email/password are missing", async () => {
    const res = await POST(loginRequest({ email: "" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mockPrisma.employee.findUnique).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const res = await POST(
      new Request("https://example.com/api/auth/login", {
        method: "POST",
        body: "not-json",
      }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});
