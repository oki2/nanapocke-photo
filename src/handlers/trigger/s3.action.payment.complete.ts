import {StorageClass} from "@aws-sdk/client-s3";
import {EventBridgeHandler} from "aws-lambda";

import {
  TRIGGER_ACTION,
  AlbumPublishedT,
} from "../../schemas/trigger.s3.action.router";

import {AlbumItemT, ShippingAddressT} from "../../schemas/public";

import {
  AppConfig,
  AlbumConfig,
  PhotoConfig,
  PriceConfig,
  PaymentConfig,
} from "../../config";
import * as S3 from "../../utils/S3";
import * as Album from "../../utils/Dynamo/Album";
import * as Photo from "../../utils/Dynamo/Photo";
import * as Cart from "../../utils/Dynamo/Cart";
import * as Payment from "../../utils/Dynamo/Payment";

interface Detail {
  bucketName: string;
  keyPath: string;
  size: string;
}

export const handler: EventBridgeHandler<string, Detail, any> = async (
  event,
  context,
) => {
  console.log("event", event);
  const {bucketName, keyPath} = event.detail;

  // keyPathを分解
  const [prefix, actionName, fileName] = keyPath.split("/");
  console.log("keyPath", keyPath);

  // S3からデータ取得
  const orderData = JSON.parse(
    await S3.S3FileReadToString(bucketName, keyPath),
  );
  console.log("orderData", orderData);

  // 注文情報を取得
  const payment = await Payment.get(orderData.orderId);

  // 注文データをS3のストレージ領域へコピー
  await S3.S3FileCopy(
    bucketName,
    keyPath,
    AppConfig.BUCKET_PHOTO_NAME,
    `paymentLog/${payment.userId}/${orderData.orderId}/order.json`,
  );

  // DL用
  const dlData = orderData.cart
    .filter((cart: any) => {
      return cart.downloadOption.selected;
    })
    .map((cart: any) => {
      return cart.photoId;
    });
  console.log("dlData", dlData);

  // DL購入が存在する場合は、DL用のレコードを登録
  if (dlData.length > 0) {
    const exp = Payment.getDownloadExpiresAt(new Date(payment.smbcProcessDate));
    await Photo.downloadAceptPhoto(
      payment.facilityCode,
      payment.userId,
      dlData,
      exp,
    );
  }

  // 印刷購入が存在する場合は、印刷用のレコードを登録

  console.log("orderData", orderData);
};
