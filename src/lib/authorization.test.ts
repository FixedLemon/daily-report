import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { employee: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const {
  isSelf,
  hasRole,
  isDirectManager,
  isDirectManagerByEmployeeId,
  assertSelfOrDirectManager,
  assertSelfOrDirectManagerByEmployeeId,
  assertDirectManager,
  assertHasRole,
} = await import("./authorization");

// doc/test_specification.md 3章のテスト前提データ
// E1: 鈴木部長（MANAGER, department D1, manager_id: null）
// E2: 山田太郎（SALES, department D2, manager_id: E1）
// E3: 佐藤花子（SALES, department D2, manager_id: E1）
// E9: 他部署社員（MANAGER, E2/E3の上長ではない）
const E1 = 1;
const E2 = 2;
const E3 = 3;
const E9 = 9;

const employeeE2 = { id: E2, managerId: E1 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isSelf", () => {
  it("returns true when the login employee is the target employee", () => {
    expect(isSelf(E2, E2)).toBe(true);
  });

  it("returns false when the login employee differs from the target employee", () => {
    expect(isSelf(E1, E2)).toBe(false);
  });
});

describe("hasRole", () => {
  it("returns true when the role array contains the given role", () => {
    expect(hasRole({ role: ["SALES", "MANAGER"] }, "SALES")).toBe(true);
    expect(hasRole({ role: ["SALES", "MANAGER"] }, "MANAGER")).toBe(true);
  });

  it("returns false when the role array does not contain the given role", () => {
    expect(hasRole({ role: ["SALES"] }, "ADMIN")).toBe(false);
  });
});

describe("isDirectManager", () => {
  it("returns true for the direct manager (E1 is E2's direct manager)", () => {
    expect(isDirectManager(E1, employeeE2)).toBe(true);
  });

  it("returns false for a non-manager, unrelated employee (E9 is not E2's manager)", () => {
    expect(isDirectManager(E9, employeeE2)).toBe(false);
  });

  it("returns false for an indirect manager (manager of the manager)", () => {
    // E1がE2の上長、E9がさらにE1の上長という間接関係を想定。
    // E2から見てE1は直属だがE9は間接的な上長であり対象外。
    const employeeE1AsTargetOfE9 = { id: E1, managerId: E9 };
    expect(isDirectManager(E9, employeeE1AsTargetOfE9)).toBe(true);
    expect(isDirectManager(E9, employeeE2)).toBe(false);
  });
});

describe("isDirectManagerByEmployeeId", () => {
  it("returns true when the target employee's managerId matches the login employee (TC-DR-11)", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(employeeE2);
    await expect(isDirectManagerByEmployeeId(E1, E2)).resolves.toBe(true);
    expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
      where: { id: E2 },
      select: { id: true, managerId: true },
    });
  });

  it("returns false for a manager who is not the direct manager (TC-DR-12: E9 is not E2's manager)", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(employeeE2);
    await expect(isDirectManagerByEmployeeId(E9, E2)).resolves.toBe(false);
  });

  it("returns false when the target employee does not exist", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(null);
    await expect(isDirectManagerByEmployeeId(E1, 9999)).resolves.toBe(false);
  });
});

describe("assertSelfOrDirectManager", () => {
  it("does not throw for the report owner (self)", () => {
    expect(() => assertSelfOrDirectManager(E2, employeeE2)).not.toThrow();
  });

  it("does not throw for the direct manager", () => {
    expect(() => assertSelfOrDirectManager(E1, employeeE2)).not.toThrow();
  });

  it("throws 403 FORBIDDEN for an employee who is neither self nor the direct manager (TC-DR-08, TC-DR-13)", () => {
    expect(() => assertSelfOrDirectManager(E3, employeeE2)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
  });

  it("throws 403 FORBIDDEN for an unrelated manager from another department (TC-DR-12)", () => {
    expect(() => assertSelfOrDirectManager(E9, employeeE2)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
  });
});

describe("assertSelfOrDirectManagerByEmployeeId", () => {
  it("does not throw for self without querying the database", async () => {
    await expect(
      assertSelfOrDirectManagerByEmployeeId(E2, E2),
    ).resolves.toBeUndefined();
    expect(mockPrisma.employee.findUnique).not.toHaveBeenCalled();
  });

  it("does not throw for the direct manager (TC-DR-11)", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(employeeE2);
    await expect(
      assertSelfOrDirectManagerByEmployeeId(E1, E2),
    ).resolves.toBeUndefined();
  });

  it("throws 403 FORBIDDEN for a manager who is not directly assigned (TC-DR-12)", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(employeeE2);
    await expect(assertSelfOrDirectManagerByEmployeeId(E9, E2)).rejects.toMatchObject(
      { code: "FORBIDDEN", status: 403 },
    );
  });
});

describe("assertDirectManager", () => {
  it("does not throw for the direct manager (TC-CM-01)", () => {
    expect(() => assertDirectManager(E1, employeeE2)).not.toThrow();
  });

  it("throws 403 FORBIDDEN for the report owner themselves (comment posting requires being the manager, not self)", () => {
    expect(() => assertDirectManager(E2, employeeE2)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
  });

  it("throws 403 FORBIDDEN for a non-direct-manager employee (TC-CM-03, TC-CM-04)", () => {
    expect(() => assertDirectManager(E9, employeeE2)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
    expect(() => assertDirectManager(E3, employeeE2)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
  });

  it("throws 403 FORBIDDEN for an indirect manager (manager of the manager)", () => {
    const employeeE1WithManagerE9 = { id: E1, managerId: E9 };
    // E9はE1の直属上長だが、E1配下のE2にとっては間接的な上長（上長の上長）であり対象外
    expect(() => assertDirectManager(E9, employeeE1WithManagerE9)).not.toThrow();
    expect(() => assertDirectManager(E9, employeeE2)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
  });
});

describe("assertHasRole", () => {
  it("does not throw when the employee has the required role", () => {
    expect(() => assertHasRole({ role: ["ADMIN"] }, "ADMIN")).not.toThrow();
  });

  it("throws 403 FORBIDDEN when the employee lacks the required role", () => {
    expect(() => assertHasRole({ role: ["SALES"] }, "ADMIN")).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
  });
});
