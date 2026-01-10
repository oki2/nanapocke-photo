import {AppConfig, PaymentConfig} from "../config";
import * as http from "../http";
import {parseOrThrow} from "../libs/validate";

import type {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";

import * as SMBC from "../utils/External/SMBC";

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
  // const query = parseOrThrow(PhotoFilters, event.queryStringParameters ?? {});
  // console.log("query", query);

  // 2. formデータを取得、判定 ==============================================================
  const post = parseBody(event);
  console.log("post", post);
  const resData = post.result.split(".");
  if (resData.length !== 2) {
    // return redirectWithCookie(actionType, "error");
    return http.badRequest({detail: "決済結果フォーマットエラー"});
  }
  // ハッシュ検証
  const payloadB64Url = resData[0];
  const postedHash = resData[1];
  const checkHash = sha256Hex(payloadB64Url + "85td5ygq");
  if (postedHash !== checkHash) {
    return http.badRequest({detail: "決済結果ハッシュ値エラー"});
  }

  // SMBCの結果をパース
  const smbcResult: SmbcResultPayload = JSON.parse(
    Buffer.from(payloadB64Url, "base64url").toString()
  );
  console.log("smbcResult", smbcResult);

  // 3. SMBCの結果をチェック ==============================================================
  // 接頭句チェック： prefix-ymd-hm-paymentId
  const orderId = smbcResult.transactionresult.OrderID;
  const [prefix, ymd, hm, paymentIdStr] = orderId.split("-");
  if (prefix !== PaymentConfig.ORDER_ID_PREFIX) {
    return http.badRequest({detail: "接続環境間違い"});
  }

  // const paymentId = Number(paymentIdStr);
  // if (!Number.isFinite(paymentId)) {
  //   return http.badRequest({detail: "PaymentIDが不正"});
  // }

  // // ErrCode / ErrInfo は「ログ出してスルー」（PHP同様）
  // if (
  //   smbcResult.transactionresult.ErrCode ||
  //   smbcResult.transactionresult.ErrInfo
  // ) {
  //   return http.badRequest({detail: "決済ページエラー"});
  // }

  // // 4. 結果の判定
  // // ステータス判定
  // const resultVal = smbcResult.transactionresult.Result;
  // let nextStatus: PaymentStatus;

  // switch (resultVal) {
  //   case SMBC.RESULT_CODE.PAYSUCCESS:
  //   case SMBC.RESULT_CODE.REQSUCCESS:
  //     nextStatus = PaymentConfig.STATUS.COMPLETED;
  //     resultCode = "success";
  //     break;

  //   case SMBC.RESULT_CODE.EXPIRED:
  //     nextStatus = PaymentConfig.STATUS.FAILED_EXPIRED;
  //     resultCode = "expired";
  //     break;

  //   case SMBC.RESULT_CODE.INVALID:
  //     nextStatus = PaymentConfig.STATUS.FAILED_SYSTEM;
  //     resultCode = "error1";
  //     break;

  //   case SMBC.RESULT_CODE.CREATE:
  //   case SMBC.RESULT_CODE.SEND:
  //   case SMBC.RESULT_CODE.PAYSTART:
  //   case SMBC.RESULT_CODE.CONFIRM:
  //     nextStatus = PaymentConfig.STATUS.FAILED_CUSTOMER;
  //     resultCode = "cancel";
  //     break;

  //   case SMBC.RESULT_CODE.REQPROCESS:
  //   case SMBC.RESULT_CODE.ERROR:
  //     nextStatus = PaymentConfig.STATUS.FAILED_ERROR;
  //     resultCode = "error2";
  //     break;

  //   default:
  //     nextStatus = PaymentConfig.STATUS.FAILED_UNKNOWN;
  //     resultCode = "error0";
  //     break;
  // }

  // // 4. 結果をDBに登録 ==============================================================
  // await Cart.updatePaymentId(
  //   authContext.facilityCode,
  //   paymentId,
  //   authContext.userId
  // );

  // // 1. 現在のカートの中身を取得
  // const cart = await Cart.list(authContext.facilityCode, authContext.userId);
  // console.log("cart", cart);

  // // 2. レスポンス形式に変換
  // const response: CartItemListT = cart.map((item: any) => {
  //   return {
  //     albumId: item.albumId,
  //     photoId: item.photoId,
  //     albumTitle: item.albumTitle,
  //     albumSequenceId: item.albumSequenceId,
  //     photoSequenceId: item.photoSequenceId,
  //     priceTier: item.priceTier,
  //     purchaseDeadline: item.purchaseDeadline,
  //     download: [item.downloadOption],
  //     print: [item.printLOption, item.print2LOption],
  //   };
  // });

  return http.ok(event);
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
