import {AppConfig, PaymentConfig} from "../config";
import * as http from "../http";
import {parseOrThrow} from "../libs/validate";

import {GetParameter} from "../utils/ParameterStore";

import {
  ShippingNotifySakuraRequest,
  ShippingOrders,
  ResultOK,
} from "../schemas/public";

import * as Payment from "../utils/Dynamo/Payment";

import * as jwt from "jsonwebtoken";
import {App} from "aws-cdk-lib";

type ShiipingNotifyPayload = {
  orderId: string;
  printerAcceptance: string;
  printerShipping: string;
  printerTracking: string;
  printerNumber: number;
};

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  // const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  // console.log("authContext", authContext);

  // 1. バリデーションチェック ==============================================
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(ShippingNotifySakuraRequest, raw);
  console.log("data", data);

  // 2. JWT 検証 ==============================================================
  const secretKey = await GetParameter(
    AppConfig.SSM_SHIPPING_NOTIRY_SECRET_KEY,
  );
  const json = parseOrThrow(
    ShippingOrders,
    jwt.verify(data.shipping, secretKey),
  );
  console.log("json", json);

  // 3. 発送状況を更新する =====================================================
  for (const order of json.orders) {
    await Payment.setShippingInfo(
      order.orderId,
      new Date(
        order.printerAcceptance.replace(/\//g, "-") + "T00:00:00+09:00",
      ).toISOString(), // 日本時間から変換、時間情報が無いので、日本時間の 00:00 にする
      new Date(
        order.printerShipping.replace(/\//g, "-") + "T00:00:00+09:00",
      ).toISOString(), // 日本時間から変換、時間情報が無いので、日本時間の 00:00 にする
      order.printerTracking,
      order.printerNumber,
    );
  }

  // 正常終了を返す
  return http.ok(parseOrThrow(ResultOK, {ok: true}));
});
