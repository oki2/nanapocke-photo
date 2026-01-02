import {AppConfig, PaymentConfig} from "../config";
import * as http from "../http";
import {ResultOK} from "../schemas/common";
import {CartItemList, CartItemListT} from "../schemas/cart";
import {parseOrThrow} from "../libs/validate";

import * as Cart from "../utils/Dynamo/Cart";
import * as Album from "../utils/Dynamo/Album";
import * as Photo from "../utils/Dynamo/Photo";
import * as Payment from "../utils/Dynamo/Payment";

import type {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";

import * as SMBC from "../utils/External/SMBC";
import * as S3 from "../utils/S3";

import * as crypto from "crypto";
import {Buffer} from "buffer";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  // 1. formデータを取得 ==============================================================
  const postObj = parseBody(event);

  // 2. ShopiIDのチェック（基本的にエラーは発生しない。不正アクセス対策）
  if ((await SMBC.checkShopId(postObj.ShopID)) === false) {
    return http.ok(SMBC.NOTIFICATION_RESPONSE.RETURN_SUCCESS, {
      "Content-Type": "text/html; charset=UTF-8",
    }); // SMBC側には正常を返す（再コール抑止）
  }

  // 3. 接頭句チェック（基本的にエラーは発生しない。不正アクセス対策）
  const [prefix, ymd, hm, paymentIdStr] = postObj.OrderID.split("-");
  if (prefix !== PaymentConfig.ORDER_ID_PREFIX) {
    return http.ok(SMBC.NOTIFICATION_RESPONSE.RETURN_SUCCESS, {
      "Content-Type": "text/html; charset=UTF-8",
    }); // SMBC側には正常を返す（再コール抑止）
  }

  // 4. コンビニ決済、かつSMBC側の処理完了の場合は、カートを空にする
  if (
    postObj.PayType == SMBC.PAY_TYPE.CBSTORE &&
    postObj.Status == SMBC.RESULT_CODE.REQSUCCESS
  ) {
    // 支払情報をDBから取得
    const payment = await Payment.get(postObj.OrderID);
    if (!payment) {
      return http.ok(SMBC.NOTIFICATION_RESPONSE.RETURN_ERROR, {
        "Content-Type": "text/html; charset=UTF-8",
      }); // SMBC側には不正を返す（再コール）
    }
    // SMBCのログを保存
    await S3.savePaymentLog(postObj.OrderID, payment.userId, postObj);

    // カートを空にする
    await Cart.cleare(payment.facilityCode, payment.userId);

    // 正常終了を返す
    return http.ok(SMBC.NOTIFICATION_RESPONSE.RETURN_SUCCESS, {
      "Content-Type": "text/html; charset=UTF-8",
    });
  }

  // 5. Request の Status チェック、CAPTURE、PAYSUCCESS以外は無視するので、SMBC側には正常を返す（再コール抑止）
  if (
    postObj.Status != SMBC.RESULT_CODE.CAPTURE &&
    postObj.Status != SMBC.RESULT_CODE.PAYSUCCESS
  ) {
    return http.ok(SMBC.NOTIFICATION_RESPONSE.RETURN_SUCCESS, {
      "Content-Type": "text/html; charset=UTF-8",
    });
  }

  // 6. SMBCに結果確認の問い合わせ
  const smbcResult = await SMBC.searchTradeMulti(
    postObj.OrderID,
    postObj.PayType
  );
  console.log("smbcResult", smbcResult);
  if (!smbcResult) {
    return http.ok(SMBC.NOTIFICATION_RESPONSE.RETURN_ERROR, {
      "Content-Type": "text/html; charset=UTF-8",
    }); // SMBC側には不正を返す（再コール）
  }

  // 7. SMBC問い合わせ結果をチェック　※ここで落ちたら不正アクセスの可能性
  if (
    smbcResult.Status != SMBC.RESULT_CODE.CAPTURE &&
    smbcResult.Status != SMBC.RESULT_CODE.PAYSUCCESS
  ) {
    return http.ok(SMBC.NOTIFICATION_RESPONSE.RETURN_ERROR, {
      "Content-Type": "text/html; charset=UTF-8",
    }); // SMBC側には不正を返す（再コール）
  }

  // 8. 支払情報をDBから取得
  const payment = await Payment.get(postObj.OrderID);
  if (!payment) {
    return http.ok(SMBC.NOTIFICATION_RESPONSE.RETURN_ERROR, {
      "Content-Type": "text/html; charset=UTF-8",
    }); // SMBC側には不正を返す（再コール）
  }
  console.log("payment", payment);

  // 9. 決済情報をS3へコピー（DL可否、印刷有無はEventトリガー経由で処理）
  await S3.paymentComplete(postObj.OrderID);

  // 10. 決済情報を「決済済み」に更新する
  await Payment.setCompleted(
    postObj.OrderID,
    smbcResult.ProcessDate,
    payment.userId,
    SMBC.CALLBACK_USER_ID
  );

  // 11. カートを空にする : クレカ、PayPayの場合
  if (
    smbcResult.PayType == SMBC.PAY_TYPE.CREDIT ||
    smbcResult.PayType == SMBC.PAY_TYPE.PAYPAY
  ) {
    await Cart.cleare(payment.facilityCode, payment.userId);
  }

  // 12.SMBCのログを保存
  await S3.savePaymentLog(postObj.OrderID, payment.userId, postObj);

  return http.ok(SMBC.NOTIFICATION_RESPONSE.RETURN_SUCCESS, {
    "Content-Type": "text/html; charset=UTF-8",
  });
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
