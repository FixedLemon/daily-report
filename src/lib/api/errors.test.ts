import { describe, expect, it, vi } from "vitest";
import { ApiError, errorResponse, handleApiError } from "./errors";

describe("ApiError.status", () => {
  it.each([
    ["VALIDATION_ERROR", 400],
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["INTERNAL_ERROR", 500],
  ] as const)("maps %s to HTTP %i", (code, status) => {
    expect(new ApiError(code, "message").status).toBe(status);
  });
});

describe("errorResponse", () => {
  it("omits details when none are given", async () => {
    const res = errorResponse(new ApiError("NOT_FOUND", "見つかりません"));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "見つかりません" },
    });
  });

  it("includes details when given", async () => {
    const res = errorResponse(
      new ApiError("VALIDATION_ERROR", "入力値が不正です", [
        { field: "email", message: "必須項目です" },
      ]),
    );
    await expect(res.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "入力値が不正です",
        details: [{ field: "email", message: "必須項目です" }],
      },
    });
  });
});

describe("handleApiError", () => {
  it("converts an ApiError to its own error response", async () => {
    const res = handleApiError(new ApiError("FORBIDDEN", "権限がありません"));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "権限がありません" },
    });
  });

  it("converts an unexpected error to a generic INTERNAL_ERROR without leaking details", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleApiError(new Error("db connection refused"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toContain("db connection refused");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
