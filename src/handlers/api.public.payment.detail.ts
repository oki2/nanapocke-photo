import {AppConfig, PaymentConfig} from "../config";
import * as http from "../http";
import {PaymentPathParameters} from "../schemas/payment";
import {parseOrThrow} from "../libs/validate";

import * as Payment from "../utils/Dynamo/Payment";
import * as S3 from "../utils/S3";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータの決済ID取得
  const path = parseOrThrow(PaymentPathParameters, event.pathParameters ?? {});

  // 1. 決済の詳細を取得
  const payment = await Payment.get(path.orderId);

  // 2. 対象の決済情報を判定
  if (
    !payment ||
    payment.userId != authContext.userId ||
    payment.paymentStatus != PaymentConfig.STATUS.COMPLETED
  ) {
    return http.notFound();
  }

  // 3. S3 から詳細取得
  const detail = JSON.parse(
    await S3.S3FileReadToString(
      AppConfig.BUCKET_PHOTO_NAME,
      `paymentLog/${authContext.userId}/${path.orderId}/order.json`
    )
  );

  // 2. レスポンス形式に変換

  return http.ok(detail);
});
