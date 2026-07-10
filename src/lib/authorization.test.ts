import { describe, expect, it } from "vitest";
import {
  isSelf,
  hasRole,
  isDirectManager,
  assertCanViewReport,
  assertDirectManager,
  assertHasRole,
} from "./authorization";

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

  it("does not chain: E9 is E1's direct manager, but that does not make E9 a direct manager of E1's subordinate E2", () => {
    // E1がE2の上長、E9がさらにE1の上長という間接関係を想定。
    // E2から見てE1は直属だがE9は間接的な上長であり対象外。
    const employeeE1AsTargetOfE9 = { id: E1, managerId: E9 };
    expect(isDirectManager(E9, employeeE1AsTargetOfE9)).toBe(true);
    expect(isDirectManager(E9, employeeE2)).toBe(false);
  });
});

describe("assertCanViewReport", () => {
  it("does not throw for the report owner (self)", () => {
    expect(() => assertCanViewReport(E2, employeeE2)).not.toThrow();
  });

  it("does not throw for the direct manager (TC-DR-11)", () => {
    expect(() => assertCanViewReport(E1, employeeE2)).not.toThrow();
  });

  it("throws 403 FORBIDDEN for an employee who is neither self nor the direct manager (TC-DR-13)", () => {
    expect(() => assertCanViewReport(E3, employeeE2)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
  });

  it("throws 403 FORBIDDEN for an unrelated manager from another department (TC-DR-12)", () => {
    expect(() => assertCanViewReport(E9, employeeE2)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
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

  it("does not chain: E9 is E1's direct manager, but that does not authorize E9 to comment on E1's subordinate E2's report", () => {
    // E9はE1の直属上長だが、E1配下のE2にとっては間接的な上長（上長の上長）であり対象外。
    const employeeE1WithManagerE9 = { id: E1, managerId: E9 };
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
