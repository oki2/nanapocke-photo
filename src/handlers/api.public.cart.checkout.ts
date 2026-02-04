import {AppConfig, PhotoConfig, PaymentConfig} from "../config";
import * as http from "../http";
import {parseOrThrow} from "../libs/validate";
import {CheckoutBody, OrderCheckout, OrderCheckoutT} from "../schemas/public";

import * as Cart from "../utils/Dynamo/Cart";
import * as Payment from "../utils/Dynamo/Payment";

import * as S3 from "../utils/S3";

import * as SMBC from "../utils/External/SMBC";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // リクエストボディの確認
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(CheckoutBody, raw);
  console.log("data", data);

  // 1. 現在のカートの中身を取得
  const cart = await Cart.list(authContext.facilityCode, authContext.userId);
  console.log("cart", cart);

  // 2. 印刷有無の判定
  const byTier = Cart.summarizeItemsByPriceTier(cart);
  console.log("byTier", byTier);
  const summary = Cart.sumAllTiers(byTier);
  console.log("summary", summary);

  // デジタルのみ指定なのに、印刷が存在する場合はエラーとする
  if (
    data.type === PaymentConfig.ORDER_TYPE.DIGITAL &&
    summary.printLQuantityTotal + summary.print2LQuantityTotal > 0
  ) {
    return http.badRequest({
      detail: "印刷購入を行う場合は配送先情報が必要です",
    });
  }

  // 写真の合計金額
  const subTotalPrice =
    summary.print2LTotalPrice +
    summary.printLTotalPrice +
    summary.downloadTotalPrice;

  // 送料計算
  const shippingFee =
    Math.ceil(
      (summary.print2LQuantityTotal + summary.printLQuantityTotal) /
        PaymentConfig.POSTAGE_MAIL_LIMIT,
    ) * PaymentConfig.SHIPPING_POSTAGE_MAIL_FEE;

  // 3. アルバム、写真の販売可否チェック

  // 5. 決済情報の作成（DynamoDB）
  const {orderId} = await Payment.create(
    authContext.facilityCode,
    authContext.userId,
    summary.printLQuantityTotal + summary.print2LQuantityTotal,
    summary.downloadSelectedCount,
    byTier[`${PhotoConfig.PRICE_TIER.STANDARD}`],
    byTier[`${PhotoConfig.PRICE_TIER.PREMIUM}`],
    subTotalPrice,
    shippingFee,
    subTotalPrice + shippingFee,
  );
  console.log("orderId", orderId);

  // 6. 購入情報の保存（S3）
  const orderData = {
    orderId: orderId,
    facilityCode: authContext.facilityCode,
    userId: authContext.userId,
    cart: cart,
    countPrint: summary.printLQuantityTotal + summary.print2LQuantityTotal,
    countDownload: summary.downloadSelectedCount,
    subTotalPrice: subTotalPrice,
    shippingFee: {
      after: shippingFee,
    },
    grandTotal: subTotalPrice + shippingFee,
    createdAt: new Date().toISOString(),
  };
  await S3.saveOrderData(orderId, orderData);

  // 7. 印刷有りの場合は、印刷情報の保存（S3）
  if (data.type === PaymentConfig.ORDER_TYPE.SHIPPING) {
    await S3.saveUserInfo(orderId, data.address);
  }

  // 8. SMBCの決済リンク作成
  const paymentUrl = await SMBC.createSmbcPaymentLink({
    orderId: orderId,
    amount: subTotalPrice + shippingFee,
    completeUrl: `https://${AppConfig.NANAPHOTO_FQDN}/api/payments/smbc/callback?status=success&orderId=${orderId}`,
    cancelUrl: `https://${AppConfig.NANAPHOTO_FQDN}/api/payments/smbc/callback?status=failed&orderId=${orderId}`,
  });

  // 9. レスポンス形式に変換
  const photos = Cart.toOrderItems(cart, {
    resolveImageUrl: (src) =>
      `/thumbnail/${src.facilityCode}/photo/${src.shootingBy}/${src.photoId}.webp`,
  });
  console.log("photos", photos);

  const response: OrderCheckoutT = {
    orderId: orderId,
    summary: {
      ...(data.type === PaymentConfig.ORDER_TYPE.SHIPPING
        ? {
            shipping: {
              method: PaymentConfig.SHIPPING_LABEL,
              address: data.address,
            },
          }
        : {}),
      photos: photos,
      hasDownloadPurchases: summary.downloadSelectedCount > 0,
      downloadPeriod: "",
      subTotal: subTotalPrice,
      shippingFee: {
        after: shippingFee,
      },
      grandTotal: subTotalPrice + shippingFee,
    },
    paymentUrl: paymentUrl,
  };

  return http.ok(parseOrThrow(OrderCheckout, response));
});
