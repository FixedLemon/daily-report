import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toValidationError } from "./validation";

describe("toValidationError", () => {
  const schema = z.object({
    email: z.string().min(1),
    visit_records: z.array(z.object({ customer_id: z.number() })),
  });

  it("converts Zod issues into details[].field / details[].message", () => {
    const result = schema.safeParse({ email: "", visit_records: [{}] });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");

    const apiError = toValidationError(result.error);
    expect(apiError.code).toBe("VALIDATION_ERROR");
    expect(apiError.status).toBe(400);
    expect(apiError.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "email" }),
        expect.objectContaining({ field: "visit_records[0].customer_id" }),
      ]),
    );
  });

  it("formats nested array indices as bracket notation matching api_specification.md's example", () => {
    const result = schema.safeParse({
      email: "a@example.com",
      visit_records: [{ customer_id: 1 }, {}],
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");

    const apiError = toValidationError(result.error);
    expect(apiError.details).toEqual([
      expect.objectContaining({ field: "visit_records[1].customer_id" }),
    ]);
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
