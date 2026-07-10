import type { ZodError } from "zod";
import { ApiError } from "./errors";

// Zodのバリデーションエラーを doc/api_specification.md 1.4 の
// VALIDATION_ERROR形式（details[].field / details[].message）に変換する。
export function toValidationError(
  zodError: ZodError,
  message = "入力値が不正です",
): ApiError {
  const details = zodError.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
  return new ApiError("VALIDATION_ERROR", message, details);
}
