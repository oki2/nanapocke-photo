import {AppConfig} from "../config";
import * as http from "../http";
import {PaymentHistoryList, PaymentHistoryListT} from "../schemas/payment";
import {parseOrThrow} from "../libs/validate";

import * as Payment from "../utils/Dynamo/Payment";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // 1. 決済履歴一覧を取得
  const payments = await Payment.myList(authContext.userId);

  // 2. レスポンス形式に変換
  const response: PaymentHistoryListT = payments.map((item: any) => {
    return {
      orderId: item.orderId,
      countPrint: item.countPrint,
      countDl: item.countDl,
      processDate: item.smbcProcessDate,
      grandTotal: item.grandTotal,
    };
  });

  return http.ok(parseOrThrow(PaymentHistoryList, response));
});
