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
  let zipDownloadStatus: downloadStatusT = PaymentConfig.DOWNLOAD_STATUS.NONE;
  let downloadExpiredAt = "";
  let isDownload = false;
  let zipDownloadUrl = "";

  if (detail.countDownload > 0) {
    // DL有効期限
    downloadExpiredAt =
      payment.downloadExpiredAt ??
      Payment.getDownloadExpiresAt(new Date(payment.smbcProcessDate));

    isDownload = new Date(downloadExpiredAt) > new Date();

    // ZIPダウンロードのステータス
    zipDownloadStatus =
      payment.zipDownloadStatus ?? PaymentConfig.DOWNLOAD_STATUS.NONE;

    // ZIPダウンロード可、かつDL有効期限内の場合、ZIPダウンロードURLを設定
    if (
      zipDownloadStatus === PaymentConfig.DOWNLOAD_STATUS.VALID &&
      isDownload
    ) {
      zipDownloadUrl = `/${Photo.userLibraryZip(
        authContext.userId,
        authContext.facilityCode,
        path.orderId,
      )}`;
    }
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
    ...(isDownload
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
      method:
        payment.shippingStatus === PaymentConfig.SHIPPING_STATUS.NONE
          ? ""
          : PaymentConfig.SHIPPING_LABEL,
      trackingNumber: payment.printerTracking ?? "",
    },
    zipDownload: {
      status: zipDownloadStatus,
      expiredAt: downloadExpiredAt,
      downloadUrl: zipDownloadUrl,
    },
    subTotal: detail.subTotalPrice,
    shippingFee: detail.shippingFee,
    grandTotal: detail.grandTotal,
  };

  // 3. レスポンスを返却
  // return http.ok(response);
  return http.ok(parseOrThrow(OrderDetail, response));
});
