import {StorageClass} from "@aws-sdk/client-s3";
import {EventBridgeHandler} from "aws-lambda";

import {
  TRIGGER_ACTION,
  AlbumPublishedT,
} from "../../schemas/trigger.s3.action.router";

import {AlbumItemT} from "../../schemas/album";
import {ShippingAddressT} from "../../schemas/cart";

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
  context
) => {
  console.log("event", event);
  const {bucketName, keyPath} = event.detail;

  // keyPathを分解
  const [prefix, actionName, fileName] = keyPath.split("/");
  console.log("keyPath", keyPath);

  switch (actionName) {
    case TRIGGER_ACTION.ALBUM_PUBLISHED:
      // 写真の情報を取得
      await albumPublished(bucketName, keyPath);
      break;
    case TRIGGER_ACTION.PAYMENT_COMPLETE:
      // 支払い完了処理
      await paymentComplete(bucketName, keyPath);
      break;
  }
};

async function albumPublished(bucketName: string, keyPath: string) {
  // S3からデータ取得
  const data: AlbumPublishedT = JSON.parse(
    await S3.S3FileReadToString(bucketName, keyPath)
  );

  // 1. アルバム情報を取得
  const album = await Album.get(data.facilityCode, data.albumId);

  // 2. 対象のアルバムに属する写真一覧を取得
  const photoList = await Photo.getPhotosByAlbumId(
    data.facilityCode,
    data.albumId
  );

  // 3. 写真Meta情報を取得（絞込み & 並べ替えも同時に）
  const photos = Photo.filterSortPagePhotos(
    photoList,
    {editability: PhotoConfig.EDITABILITY.EDITABLE},
    {field: "shootingAt", order: "asc"},
    {
      limit: AlbumConfig.MAX_PHOTO_COUNT,
    }
  );
  console.log("photos", photos);

  // 4. 料金等を計算し、保護者向け情報に変換
  const photosObj = photos.items.map((photo) => {
    return {
      photoId: photo.photoId,
      sequenceId: photo.sequenceId,
      imageUrl: `/thumbnail/${photo.facilityCode}/${photo.createdBy}/${photo.photoId}.webp`,
      priceTier: photo.priceTier,
      shootingAt: photo.shootingAt,
      width: photo.width,
      height: photo.height,
      salesSizeDl: photo.salesSizeDl.map((size) => {
        return {
          size: size,
          price:
            PriceConfig.PHOTO_PRICE[album.priceTable][photo.priceTier][size],
        };
      }),
      salesSizePrint: photo.salesSizePrint.map((size) => {
        return {
          size: size,
          price:
            PriceConfig.PHOTO_PRICE[album.priceTable][photo.priceTier][size],
        };
      }),
    };
  });

  const albumObj: AlbumItemT = {
    albumId: album.albumId,
    sequenceId: album.sequenceId,
    title: album.title,
    description: album.description,
    salesStatus: album.salesStatus,
    priceTable: album.priceTable,
    photoCount: photosObj.length,
    coverImageUrl: album.coverImage
      ? `/thumbnail/${album.facilityCode}/album/${album.albumId}/${album.coverImage}`
      : "",
    salesPeriod: album.salesPeriod,
  };

  const dataObj = {
    album: albumObj,
    photos: photosObj,
  };

  // 5. S3へ保存
  await S3.S3FilePut(
    AppConfig.BUCKET_PHOTO_NAME,
    `sales/${data.facilityCode}/${data.albumId}.json`,
    JSON.stringify(dataObj)
  );

  // 6. アルバム情報を更新（販売中に変更）
  await Album.actionSalesPublished(
    data.facilityCode,
    data.albumId,
    photosObj.length,
    data.userId
  );

  // 7. ナナポケへの通知が必要な場合は通知 ※データをS3Eventトリガー経由で送信
  if (album.topicsSend) {
    console.log("album.topicsSend", album.topicsSend);
  }
}

/**
 * 決済完了後に実行される処理
 * DL用のレコード登録、印刷送信等を実行
 *
 * @param {string} bucketName - S3 bucket name
 * @param {string} keyPath - S3 key path
 */
async function paymentComplete(bucketName: string, keyPath: string) {
  // S3からデータ取得
  const orderData = JSON.parse(
    await S3.S3FileReadToString(bucketName, keyPath)
  );
  console.log("orderData", orderData);

  // 注文情報を取得
  const payment = await Payment.get(orderData.orderId);

  // しまうま用の注文番号を生成
  const pOrderId =
    orderData.orderId[0] + orderData.orderId[3] + orderData.orderId.slice(19);
  const printDataAry = [];

  // 印刷がある場合は送付先情報を取得
  let address: ShippingAddressT | null = null;
  if (orderData.countPrint > 0) {
    address = await S3.getUserInfo(orderData.orderId);
  }
  // 現在日時（日本時間）のyyyyMMdd を取得
  const now = new Date();
  const jstTime = now.getTime() + 9 * 60 * 60 * 1000;
  const jstDate = new Date(jstTime);
  const yyyy = jstDate.getUTCFullYear();
  const mm = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jstDate.getUTCDate()).padStart(2, "0");
  const orderYmd = `${yyyy}${mm}${dd}`;

  // DL用
  const dlData = [];

  // カート内情報を処理
  for (const cart of orderData.cart) {
    // 印刷Lがある場合
    if (cart.printLOption.quantity) {
      printDataAry.push({
        photoId: cart.photoId,
        photoSequanceId: cart.photoSequenceId,
        size: "L",
        quantity: cart.printLOption.quantity,
      });
    }

    // 印刷2Lがある場合
    if (cart.print2LOption.quantity) {
      printDataAry.push({
        photoId: cart.photoId,
        photoSequanceId: cart.photoSequenceId,
        size: "2L",
        quantity: cart.print2LOption.quantity,
      });
    }

    // DLがある場合
    if (cart.downloadOption.selected) {
      dlData.push(cart.photoId);
    }
  }

  console.log("printDataAry", printDataAry);
  console.log("dlData", dlData);

  // DL購入が存在する場合は、DL用のレコードを登録
  if (dlData.length > 0) {
    const exp = Payment.getDownloadExpiresAt(new Date(payment.smbcProcessDate));
    await Photo.downloadAceptPhoto(
      payment.facilityCode,
      payment.userId,
      dlData,
      exp
    );
  }

  // 決済ログをS3のストレージ領域へコピー
  await S3.S3FileCopy(
    bucketName,
    keyPath,
    AppConfig.BUCKET_PHOTO_NAME,
    `paymentLog/${payment.userId}/${orderData.orderId}/order.json`
  );

  // 印刷購入が存在する場合は、印刷用のレコードを登録

  console.log("orderData", orderData);
}
