import {AppConfig, PaymentConfig} from "../config";
import * as http from "../http";
import {parseOrThrow} from "../libs/validate";
import {SmbcCallback} from "../schemas/public";
import type {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import * as crypto from "crypto";
import {Buffer} from "buffer";

type SmbcResultPayload = {
  transactionresult: {
    OrderID: string;
    Result?: string;
    ErrCode?: string;
    ErrInfo?: string;
  };
};

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  // const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  // console.log("authContext", authContext);

  // 1. クエリストリングチェック code を取得 ==============================================
  const query = parseOrThrow(SmbcCallback, event.queryStringParameters ?? {});
  console.log("query", query);

  // 2. formデータを取得、判定 ==============================================================
  const post = parseBody(event);
  console.log("post", post);
  const resData = post.result.split(".");
  if (resData.length !== 2) {
    // return redirectWithCookie(actionType, "error");
    return http.badRequest({detail: "決済結果フォーマットエラー"});
  }

  // 3. ハッシュ検証
  const payloadB64Url = resData[0];
  const postedHash = resData[1];
  const checkHash = sha256Hex(payloadB64Url + "85td5ygq");
  if (postedHash !== checkHash) {
    return http.badRequest({detail: "決済結果ハッシュエラー"});
  }
  const smbcResult: SmbcResultPayload = JSON.parse(
    Buffer.from(payloadB64Url, "base64url").toString(),
  );
  console.log("smbcResult", smbcResult);

  // 4. SMBCの結果をチェック ==============================================================
  // 接頭句チェック： prefix-ymd-hm-paymentId
  const orderId = smbcResult.transactionresult.OrderID;
  const [prefix, ymd, hm, paymentIdStr] = orderId.split("-");
  if (prefix !== PaymentConfig.ORDER_ID_PREFIX) {
    return http.badRequest({detail: "決済結果接続先エラー"});
  }

  // 正常の場合は、決済完了ページへ遷移させる
  if (
    query.status == "success" &&
    smbcResult.transactionresult.OrderID === query.orderId
  ) {
    return http.seeOther(
      `https://${AppConfig.NANAPHOTO_FQDN}/member/payment/success`,
    );
  }

  // その他の場合は失敗ページへ
  return http.seeOther(
    `https://${AppConfig.NANAPHOTO_FQDN}/member/payment/failed`,
  );
});

function parseBody(event: APIGatewayProxyEventV2): Record<string, string> {
  const raw = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body
    : "";

  const contentType =
    event.headers["content-type"] ?? event.headers["Content-Type"] ?? "";

  // 典型：application/x-www-form-urlencoded（SMBCのPOST想定）
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const sp = new URLSearchParams(raw);
    const obj: Record<string, string> = {};
    for (const [k, v] of sp.entries()) obj[k] = v;
    return obj;
  }

  // JSONで来る場合にも一応対応
  if (contentType.includes("application/json")) {
    const parsed = safeJsonParse(raw);
    if (parsed && typeof parsed === "object") {
      const obj: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "string") obj[k] = v;
      }
      return obj;
    }
  }

  // その他：空扱い
  return {};
}

function safeJsonParse(str: string): unknown | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}
