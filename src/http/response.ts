// src/http/response.ts
import {APIGatewayProxyStructuredResultV2} from "aws-lambda";
import {AppError} from "../errors/AppError";
import {ValidationError} from "../errors/ValidationError";

/** ---- 共通型（RFC7807 風） ---- */
export type ProblemJson = {
  type?: string; // e.g. about:blank / urn:...
  title: string; // 人が読めるタイトル
  status: number; // HTTP ステータス
  detail?: string; // 詳細メッセージ
  instance?: string; // リソース識別子など
  code?: string; // アプリ固有コード
  issues?: Record<string, any>; // バリデーション詳細
  requestId?: string; // トレース用
};

type Headers = Record<string, string>;
type Cookies = string[];

/** ---- 既定ヘッダ（必要なら呼び出し元で上書き） ---- */
const DEFAULT_HEADERS: Headers = {
  "content-type": "application/json; charset=utf-8",
  // "access-control-allow-origin": "*",
  // "access-control-allow-headers": "content-type,authorization",
  // "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

/** ---- 共通シリアライザ ---- */
function json(
  status: number,
  body: unknown,
  headers?: Headers,
  cookies?: Cookies
): APIGatewayProxyStructuredResultV2 {
  const merged = {...DEFAULT_HEADERS, ...(headers || {})};
  // requestId があればヘッダにも反映（下位で付与可）
  const maybeReqId = (body as any)?.requestId as string | undefined;
  if (maybeReqId && !merged["x-request-id"])
    merged["x-request-id"] = maybeReqId;

  return {
    statusCode: status,
    headers: merged,
    cookies: cookies,
    body: JSON.stringify(body),
  };
}

/** ---- 成功系ヘルパー ---- */
export const ok = (data: unknown, headers?: Headers, cookies?: Cookies) =>
  json(200, data, headers, cookies);

export const created = (location: string, data?: unknown, headers?: Headers) =>
  json(201, data ?? {ok: true}, {location, ...(headers || {})});

export const noContent = (
  headers?: Headers
): APIGatewayProxyStructuredResultV2 => ({
  statusCode: 204,
  headers: {...DEFAULT_HEADERS, ...(headers || {})},
});

/** ---- 旧関数互換（必要なら残す） ---- */
export const badRequest = (issues: Record<string, string>) =>
  problem(400, {
    title: "Validation failed",
    code: "VALIDATION_ERROR",
    issues,
  });

export const unauthorized = (message = "Unauthorized") =>
  problem(401, {
    title: "Unauthorized",
    code: "UNAUTHORIZED",
    detail: message,
  });

export const forbidden = (message = "Forbidden") =>
  problem(403, {
    title: "Forbidden",
    code: "FORBIDDEN",
    detail: message,
  });

export const notFound = (message = "Resource not found") =>
  problem(404, {
    title: "Resource not found",
    code: "RESOURCE_NOT_FOUND",
    detail: message,
  });

export const serverError = (message = "Internal Server Error") =>
  problem(500, {
    title: "Internal Server Error",
    code: "INTERNAL",
    detail: message,
  });

/** ---- Problem+JSON 出力 ---- */
export function problem(
  status: number,
  p: Omit<ProblemJson, "status">,
  headers?: Headers
) {
  return json(status, {...p, status}, headers);
}

/** ---- AWS SDK v3 エラー判定/抽出 ---- */
type AwsSdkLikeError = {
  name?: string;
  message?: string;
  $metadata?: {requestId?: string};
  requestId?: string;
  RequestId?: string;
};

function isAwsError(e: any): e is AwsSdkLikeError {
  return !!(e && (e.name || e.$metadata || e.requestId || e.RequestId));
}

function getAwsRequestId(e: AwsSdkLikeError): string | undefined {
  return e.$metadata?.requestId || e.requestId || e.RequestId;
}

/** ---- AWS エラー → HTTP マッピング（テーブル駆動） ---- */
const AWS_ERROR_MAP: Record<
  string, // err.name
  {status: number; code: string; title: string; headers?: Headers}
> = {
  ConditionalCheckFailedException: {
    status: 409,
    code: "ALREADY_EXISTS",
    title: "Conditional check failed",
  },
  TransactionCanceledException: {
    status: 409,
    code: "TRANSACTION_CONFLICT",
    title: "Transaction canceled",
  },
  ProvisionedThroughputExceededException: {
    status: 429,
    code: "THROTTLED",
    title: "Provisioned throughput exceeded",
    headers: {"Retry-After": "1"},
  },
  ThrottlingException: {
    status: 429,
    code: "THROTTLED",
    title: "Request throttled",
    headers: {"Retry-After": "1"},
  },
  Throttling: {
    status: 429,
    code: "THROTTLED",
    title: "Request throttled",
    headers: {"Retry-After": "1"},
  },
  UserNotFoundException: {
    status: 401,
    code: "RESOURCE_NOT_FOUND",
    title: "User not found",
  },
  NotAuthorizedException: {
    status: 401,
    code: "NOT_AUTHORIZED",
    title: "Not authorized",
  },
  UsernameExistsException: {
    status: 409,
    code: "USERNAME_EXISTS",
    title: "Username already exists",
  },
  CodeMismatchException: {
    status: 400,
    code: "CODE_MISMATCH",
    title: "Invalid verification code",
  },
  ExpiredCodeException: {
    status: 400,
    code: "CODE_EXPIRED",
    title: "Verification code expired",
  },
  TooManyRequestsException: {
    status: 429,
    code: "THROTTLED",
    title: "Too many requests",
    headers: {"Retry-After": "1"},
  },
  LimitExceededException: {
    status: 429,
    code: "THROTTLED",
    title: "Limit exceeded",
    headers: {"Retry-After": "1"},
  },
  ResourceNotFoundException: {
    status: 403, // 本来は404だが、Cloudfront 側の対応までは403で対応する
    code: "RESOURCE_NOT_FOUND",
    title: "Resource not found",
  },
  AccessDeniedException: {
    status: 403,
    code: "FORBIDDEN",
    title: "Access denied",
  },
  UnauthorizedException: {
    status: 401, // 未認証は401
    code: "UNAUTHORIZED",
    title: "Unauthorized",
  },
  ValidationException: {
    status: 400,
    code: "AWS_VALIDATION_ERROR",
    title: "AWS validation error",
  },
  InternalServerError: {
    status: 503,
    code: "AWS_INTERNAL_ERROR",
    title: "Upstream internal error",
    headers: {"Retry-After": "1"},
  },
  InternalServerException: {
    status: 503,
    code: "AWS_INTERNAL_ERROR",
    title: "Upstream internal error",
    headers: {"Retry-After": "1"},
  },
};

function mapAwsToHttp(e: AwsSdkLikeError) {
  const name = e.name || "AWS_ERROR";
  console.log("e.name", name);
  const entry = AWS_ERROR_MAP[name];
  console.log("entry", entry);
  const requestId = getAwsRequestId(e);
  console.log("requestId", requestId);

  if (entry) {
    return problem(
      entry.status,
      {
        title: entry.title,
        code: entry.code,
        detail: e.message,
        requestId,
      },
      entry.headers
    );
  }

  // 未知の AWS エラーは 502(Bad Gateway) に寄せる
  return problem(502, {
    title: "Upstream error",
    code: name,
    detail: e.message,
    requestId,
  });
}

/** ---- アプリ例外 → HTTP ---- */
function mapAppToHttp(err: AppError, requestId?: string) {
  const base = {
    title: err.name || "Application error",
    code: (err as any).code || err.name || "APP_ERROR",
    detail: err.message,
    requestId,
  } as ProblemJson;

  console.log("mapAppToHttp : err", err);
  console.log("mapAppToHttp : base", base);

  if (err instanceof ValidationError && (err as any).details) {
    base.issues = (err as any).details;
  } else if ((err as any).details) {
    (base as any).details = (err as any).details;
  }

  const status = (err as any).statusCode ?? 400;
  return problem(status, base);
}

/** ---- 最終エラーハンドラ（これだけ呼べばOK） ---- */
export function toApiError(
  err: unknown,
  opts?: {
    requestId?: string;
    instance?: string;
    log?: (msg: string, meta?: any) => void;
  }
): APIGatewayProxyStructuredResultV2 {
  const log = opts?.log ?? console.error;
  const requestId = opts?.requestId;

  // 1) アプリ定義エラー
  if (err instanceof AppError) {
    console.log("AppError");
    return mapAppToHttp(err, requestId);
  }

  // 2) AWS エラー
  if (isAwsError(err)) {
    // 重要情報に気を付けてログ
    log("AWS Error", {name: err.name, message: err.message, requestId});
    return mapAwsToHttp(err);
  }

  // 3) 予期せぬエラー
  log("Unexpected Error", err);
  return problem(500, {
    title: "Internal Server Error",
    code: "INTERNAL_SERVER_ERROR",
    detail: "Something went wrong.",
    requestId,
    instance: opts?.instance,
  });
}

/** ---- ハンドラを包む HOF：毎回try/catch不要 ---- */
type AnyHandler = (
  event: any,
  ctx: any
) => Promise<APIGatewayProxyStructuredResultV2 | void | undefined>;

export function withHttp(handler: AnyHandler): AnyHandler {
  return async (event, ctx) => {
    const reqId =
      event?.requestContext?.requestId ||
      event?.headers?.["x-request-id"] ||
      undefined;

    try {
      const res = await handler(event, ctx);
      // void/undefined が返ったら 204 にする（任意）
      if (res == null) return noContent({"x-request-id": reqId ?? ""});
      // レスポンス側に x-request-id が無い場合は付与
      if (res.headers && reqId && !res.headers["x-request-id"]) {
        res.headers["x-request-id"] = reqId;
      }
      return res;
    } catch (e) {
      const tmp = toApiError(e, {requestId: reqId});
      console.log("tmp", tmp);
      return tmp;
    }
  };
}
