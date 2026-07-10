import type { ZodError } from "zod";
import { ApiError } from "./errors";

// doc/api_specification.md 1.4 のエラー例（"visit_records[0].customer_id"）に合わせ、
// 配列インデックスは `[index]`、オブジェクトのネストは `.` で表現する。
// Zodスキーマのキーはリクエストボディ（snake_case）とそのまま対応させる想定。
function formatFieldPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "(root)";
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }
    const key = String(segment);
    return acc === "" ? key : `${acc}.${key}`;
  }, "");
}

// Zodのバリデーションエラーを doc/api_specification.md 1.4 の
// VALIDATION_ERROR形式（details[].field / details[].message）に変換する。
export function toValidationError(
  zodError: ZodError,
  message = "入力値が不正です",
): ApiError {
  const details = zodError.issues.map((issue) => ({
    field: formatFieldPath(issue.path),
    message: issue.message,
  }));
  return new ApiError("VALIDATION_ERROR", message, details);
}
