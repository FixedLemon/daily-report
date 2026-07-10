import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { parsePagination } from "./pagination";

describe("parsePagination", () => {
  it("defaults to page=1, pageSize=20 when omitted", () => {
    expect(parsePagination(new URLSearchParams())).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it("parses explicit page and page_size", () => {
    expect(
      parsePagination(new URLSearchParams("page=3&page_size=50")),
    ).toEqual({ page: 3, pageSize: 50 });
  });

  it("clamps page_size to 100 when it exceeds the maximum", () => {
    expect(parsePagination(new URLSearchParams("page_size=500"))).toEqual({
      page: 1,
      pageSize: 100,
    });
  });

  it("throws a VALIDATION_ERROR ApiError for a non-numeric page", () => {
    expect(() => parsePagination(new URLSearchParams("page=abc"))).toThrow(
      ApiError,
    );
  });

  it("throws a VALIDATION_ERROR ApiError for page=0", () => {
    try {
      parsePagination(new URLSearchParams("page=0"));
      throw new Error("expected parsePagination to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("VALIDATION_ERROR");
    }
  });
});
