import { NextResponse } from "next/server";

export interface ListMeta {
  page: number;
  pageSize: number;
  totalCount: number;
}

// doc/api_specification.md 1.3: 一覧系レスポンスのエンベロープ { data, meta }
export function listResponse<T>(data: T[], meta: ListMeta): NextResponse {
  return NextResponse.json({
    data,
    meta: {
      page: meta.page,
      page_size: meta.pageSize,
      total_count: meta.totalCount,
    },
  });
}

// doc/api_specification.md 1.3: 単体取得・作成・更新系レスポンスのエンベロープ { data }
export function itemResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}
