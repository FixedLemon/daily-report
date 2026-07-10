import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("sample setup check", () => {
  it("validates a simple Zod schema", () => {
    const schema = z.object({ name: z.string() });
    expect(schema.parse({ name: "daily-report" })).toEqual({
      name: "daily-report",
    });
  });
});
