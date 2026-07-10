import { ApiError } from "./errors";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

function parsePositiveInt(raw: string, field: string): number {
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new ApiError("VALIDATION_ERROR", "クエリパラメータの形式が不正です", [
      { field, message: "1以上の整数を指定してください" },
    ]);
  }
  return Number(raw);
}

// doc/api_specification.md 1.5: page（デフォルト1）/ page_size（デフォルト20、最大100）。
// page_sizeが100を超えて指定された場合はエラーにせず100件に丸める（一覧APIの負荷上限を
// クライアントの指定ミスでエラーにするより、上限値で応答する方が呼び出し側に優しいための判断）。
export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const pageRaw = searchParams.get("page");
  const pageSizeRaw = searchParams.get("page_size");

  const page = pageRaw !== null ? parsePositiveInt(pageRaw, "page") : DEFAULT_PAGE;
  const pageSize =
    pageSizeRaw !== null
      ? Math.min(parsePositiveInt(pageSizeRaw, "page_size"), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return { page, pageSize };
}
