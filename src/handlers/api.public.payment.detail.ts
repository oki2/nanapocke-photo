import {AppConfig, PaymentConfig, PhotoConfig} from "../config";
import * as http from "../http";
import {
  PaymentPathParameters,
  OrderDetail,
  OrderDetailT,
} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Cart from "../utils/Dynamo/Cart";
import * as Photo from "../utils/Dynamo/Photo";

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
      `paymentLog/${authContext.userId}/${path.orderId}/order.json`,
    ),
  );

  // 4. Doownload の状態を判定
  type downloadStatusT =
    (typeof PaymentConfig.DOWNLOAD_STATUS)[keyof typeof PaymentConfig.DOWNLOAD_STATUS];
  let downloadStatus: downloadStatusT = PaymentConfig.DOWNLOAD_STATUS.NONE;
  let downloadExpiredAt = "";
  let downloadZipDownloadUrl = "";

  if (detail.countDownload > 0) {
    downloadExpiredAt =
      payment.downloadExpiredAt ??
      Payment.getDownloadExpiresAt(new Date(payment.smbcProcessDate));
    downloadStatus =
      new Date(downloadExpiredAt) > new Date()
        ? PaymentConfig.DOWNLOAD_STATUS.VALID
        : PaymentConfig.DOWNLOAD_STATUS.INVALID;
    downloadZipDownloadUrl =
      downloadStatus === PaymentConfig.DOWNLOAD_STATUS.VALID
        ? "S3のDL用URLを組み立てて返す"
        : "";
  }

  // 5. レスポンス形式に変換
  const photos = Cart.toOrderItems(detail.cart, {
    resolveImageUrl: (src) =>
      `/${Photo.userLibraryThumbnail(
        authContext.userId,
        src.facilityCode,
        src.photoId,
        src.photoSequenceId,
      )}`,
    ...(downloadStatus === PaymentConfig.DOWNLOAD_STATUS.VALID
      ? {
          resolveDownloadUrl: (src) =>
            `/${Photo.userLibraryPhoto(
              authContext.userId,
              src.facilityCode,
              src.photoId,
              src.photoSequenceId,
            )}`,
        }
      : {}),
  });
  console.log("photos", photos);

  // 5. レスポンス形式に変換
  const response: OrderDetailT = {
    orderId: path.orderId,
    processDate: payment.smbcProcessDate,
    photos: photos,
    shipping: {
      status: payment.shippingStatus,
      method: PaymentConfig.SHIPPING_LABEL,
      trackingNumber: payment.shippingTrackingNumber ?? "",
    },
    download: {
      status: downloadStatus,
      expiredAt: downloadExpiredAt,
      zipDownloadUrl: downloadZipDownloadUrl,
    },
    subTotal: detail.subTotalPrice,
    shippingFee: detail.shippingFee,
    grandTotal: detail.grandTotal,
  };

  // 3. レスポンスを返却
  return http.ok(response);
  // return http.ok(parseOrThrow(OrderDetail, response));
});
