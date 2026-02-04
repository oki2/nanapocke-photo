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
  ApplicationConfig,
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
      return {
        photoId: cart.photoId,
        photoSequenceId: cart.photoSequenceId,
        shootingBy: cart.shootingBy,
      };
    });
  console.log("dlData", dlData);

  // 印刷用
  const printData = orderData.cart
    .filter((cart: any) => {
      return (
        cart.print2LOption?.quantity > 0 || cart.printLOption?.quantity > 0
      );
    })
    .map((cart: any) => {
      return {
        photoId: cart.photoId,
        photoSequenceId: cart.photoSequenceId,
        shootingBy: cart.shootingBy,
      };
    });

  // DL購入が存在する場合は
  if (dlData.length > 0) {
    for (const data of dlData) {
      // 写真コピー
      await S3.S3FileCopy(
        AppConfig.BUCKET_PHOTO_NAME,
        `storage/photo/${payment.facilityCode}/${data.shootingBy}/${data.photoId}/${data.photoSequenceId}-${PhotoConfig.PHOTO_SIZE_SUFFIX.DL_ORIGINAL}.jpg`,
        AppConfig.BUCKET_LIBRARY_NAME,
        Photo.userLibraryPhoto(
          payment.userId,
          payment.facilityCode,
          data.photoId,
          data.photoSequenceId,
        ),
        StorageClass.STANDARD_IA,
        ApplicationConfig.S3_LIFECYCLE_TAG.DL_PHOTO_DELETE,
      );

      // サムネイルコピー
      await S3.S3FileCopy(
        AppConfig.BUCKET_PHOTO_NAME,
        `thumbnail/${payment.facilityCode}/photo/${data.shootingBy}/${data.photoId}.webp`,
        AppConfig.BUCKET_LIBRARY_NAME,
        Photo.userLibraryThumbnail(
          payment.userId,
          payment.facilityCode,
          data.photoId,
          data.photoSequenceId,
        ),
        StorageClass.STANDARD_IA,
        ApplicationConfig.S3_LIFECYCLE_TAG.DL_PHOTO_DELETE,
      );
    }

    // DL用のレコードを登録
    const exp = Payment.getDownloadExpiresAt(new Date(payment.smbcProcessDate));
    await Photo.setDownloadAceptPhoto(
      payment.facilityCode,
      payment.userId,
      dlData,
      payment.smbcProcessDate,
      exp,
    );
  }
  // 印刷購入が存在する場合は、サムネイルのみ作成
  if (dlData.length > 0) {
    for (const data of printData) {
      // サムネイルコピー
      await S3.S3FileCopy(
        AppConfig.BUCKET_PHOTO_NAME,
        `thumbnail/${payment.facilityCode}/photo/${data.shootingBy}/${data.photoId}.webp`,
        AppConfig.BUCKET_LIBRARY_NAME,
        Photo.userLibraryThumbnail(
          payment.userId,
          payment.facilityCode,
          data.photoId,
          data.photoSequenceId,
        ),
        StorageClass.STANDARD_IA,
      );
    }
  }

  console.log("orderData", orderData);
};
