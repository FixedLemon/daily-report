import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toValidationError } from "./validation";

describe("toValidationError", () => {
  const schema = z.object({
    email: z.string().min(1),
    visitRecords: z.array(z.object({ customerId: z.number() })),
  });

  it("converts Zod issues into details[].field / details[].message", () => {
    const result = schema.safeParse({ email: "", visitRecords: [{}] });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");

    const apiError = toValidationError(result.error);
    expect(apiError.code).toBe("VALIDATION_ERROR");
    expect(apiError.status).toBe(400);
    expect(apiError.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "email" }),
        expect.objectContaining({ field: "visitRecords.0.customerId" }),
      ]),
    );
  });

  it("uses a fallback field name for root-level issues", () => {
    const result = z.string().safeParse(123);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");

    const apiError = toValidationError(result.error);
    expect(apiError.details).toEqual([
      expect.objectContaining({ field: "(root)" }),
    ]);
  });
});
