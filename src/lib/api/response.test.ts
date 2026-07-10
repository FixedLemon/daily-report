import { describe, expect, it } from "vitest";
import { itemResponse, listResponse } from "./response";

describe("listResponse", () => {
  it("builds a { data, meta } envelope with snake_case meta keys", async () => {
    const res = listResponse([{ id: 1 }, { id: 2 }], {
      page: 2,
      pageSize: 20,
      totalCount: 42,
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: [{ id: 1 }, { id: 2 }],
      meta: { page: 2, page_size: 20, total_count: 42 },
    });
  });
});

describe("itemResponse", () => {
  it("builds a { data } envelope with status 200 by default", async () => {
    const res = itemResponse({ id: 1 });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { id: 1 } });
  });

  it("accepts a custom status code (e.g. 201 Created)", async () => {
    const res = itemResponse({ id: 1 }, 201);
    expect(res.status).toBe(201);
  });
});
