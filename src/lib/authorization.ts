import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api/errors";

// doc/api_specification.md 1.2: role配列は "SALES" / "MANAGER" / "ADMIN" のいずれかを要素に持つ。
export type Role = "SALES" | "MANAGER" | "ADMIN";

export interface EmployeeRoleLike {
  role: string[];
}

// 認可判定に必要な最小限のフィールド。日報のemployeeIdやコメント対象社員など、
// 既にDBから取得済みのレコードをそのまま渡せるようにフィールド名を揃えている。
export interface ManagerCheckTarget {
  id: number;
  managerId: number | null;
}

// 本人判定: ログインユーザーが対象社員本人かどうか。
export function isSelf(loginEmployeeId: number, targetEmployeeId: number): boolean {
  return loginEmployeeId === targetEmployeeId;
}

// ロール判定: role配列に指定ロールが含まれるか。
export function hasRole(employee: EmployeeRoleLike, role: Role): boolean {
  return employee.role.includes(role);
}

// 直属の上長判定: target.managerId が login社員のIDと一致するかのみを見る。
// manager_idを再帰的に辿らないため、上長の上長のような間接的な関係は対象外
// （doc/requirements.md 5章「閲覧・コメント権限」、TC-DR-12, TC-CM-03）。
export function isDirectManager(
  loginEmployeeId: number,
  target: ManagerCheckTarget,
): boolean {
  return target.managerId === loginEmployeeId;
}

// target社員をemployee_idからDB参照して直属の上長判定を行う版。
// GET /daily-reports?employee_id=... のようにtarget社員のレコードをまだ
// 取得していない呼び出し元向け。
export async function isDirectManagerByEmployeeId(
  loginEmployeeId: number,
  targetEmployeeId: number,
): Promise<boolean> {
  const target = await prisma.employee.findUnique({
    where: { id: targetEmployeeId },
    select: { id: true, managerId: true },
  });
  if (!target) {
    return false;
  }
  return isDirectManager(loginEmployeeId, target);
}

const DEFAULT_FORBIDDEN_MESSAGE = "この操作を行う権限がありません";

// 本人 または 直属の上長 のいずれでもない場合に403 FORBIDDENを投げる。
// GET/PUT /daily-reports の認可判定用（本人は自分の日報を、上長は部下の日報を扱える）。
export function assertSelfOrDirectManager(
  loginEmployeeId: number,
  target: ManagerCheckTarget,
  message: string = DEFAULT_FORBIDDEN_MESSAGE,
): void {
  if (isSelf(loginEmployeeId, target.id) || isDirectManager(loginEmployeeId, target)) {
    return;
  }
  throw new ApiError("FORBIDDEN", message);
}

// employee_idのみが分かっている場合（一覧取得APIのクエリパラメータ等）向けの非同期版。
export async function assertSelfOrDirectManagerByEmployeeId(
  loginEmployeeId: number,
  targetEmployeeId: number,
  message: string = DEFAULT_FORBIDDEN_MESSAGE,
): Promise<void> {
  if (isSelf(loginEmployeeId, targetEmployeeId)) {
    return;
  }
  const isManager = await isDirectManagerByEmployeeId(loginEmployeeId, targetEmployeeId);
  if (!isManager) {
    throw new ApiError("FORBIDDEN", message);
  }
}

// 直属の上長でなければ403 FORBIDDENを投げる（本人は含まない）。
// コメント投稿(F-30)は「対象日報の作成者の manager_id == ログインユーザー」でのみ許可され、
// 本人（営業担当者自身）によるコメント投稿は認可マトリクス上も不可のため区別している。
export function assertDirectManager(
  loginEmployeeId: number,
  target: ManagerCheckTarget,
  message: string = "コメントを投稿する権限がありません",
): void {
  if (!isDirectManager(loginEmployeeId, target)) {
    throw new ApiError("FORBIDDEN", message);
  }
}

// 指定ロールを持たない場合に403 FORBIDDENを投げる。マスタ操作(5章)は管理者のみ、等。
export function assertHasRole(
  employee: EmployeeRoleLike,
  role: Role,
  message: string = DEFAULT_FORBIDDEN_MESSAGE,
): void {
  if (!hasRole(employee, role)) {
    throw new ApiError("FORBIDDEN", message);
  }
}
