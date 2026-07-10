import { NextResponse } from "next/server";

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

// doc/api_specification.md 1.4 のHTTPステータス対応表。
const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export interface ApiErrorDetail {
  field: string;
  message: string;
}

// doc/api_specification.md 1.4 のエラーレスポンス形式に対応する例外。
// APIルートハンドラはこれをthrowし、handleApiErrorで一括してレスポンスに変換する。
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: ApiErrorDetail[];

  constructor(code: ApiErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return API_ERROR_STATUS[this.code];
  }
}

export function errorResponse(error: ApiError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && error.details.length > 0
          ? { details: error.details }
          : {}),
      },
    },
    { status: error.status },
  );
}

// ルートハンドラのtry/catchで受けた例外を仕様通りのエラーレスポンスに変換する。
// ApiError以外（想定外の例外）はサーバーログに残しつつ、詳細を返さずINTERNAL_ERRORとする。
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return errorResponse(error);
  }
  console.error(error);
  return errorResponse(
    new ApiError("INTERNAL_ERROR", "サーバー内部でエラーが発生しました"),
  );
}
