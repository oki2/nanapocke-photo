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
  const data: AlbumPublishedT = JSON.parse(
    await S3.S3FileReadToString(bucketName, keyPath),
  );

  // 1. アルバム情報を取得
  const album = await Album.get(data.facilityCode, data.albumId);

  // 2. 対象のアルバムに属する写真一覧を取得
  const photoList = await Photo.getPhotosByAlbumId(
    data.facilityCode,
    data.albumId,
  );

  // 3. 写真Meta情報を取得（絞込み & 並べ替えも同時に）
  const photos = Photo.filterSortPagePhotos(
    photoList,
    {},
    {field: "shootingAt", order: "asc"},
    {
      limit: AlbumConfig.MAX_PHOTO_COUNT,
    },
  );
  console.log("photos", photos);

  // 4. 料金等を計算し、保護者向け情報に変換
  const photoIds: string[] = [];
  const photosObj = photos.items.map((photo) => {
    photoIds.push(photo.photoId);
    return {
      photoId: photo.photoId,
      sequenceId: photo.sequenceId,
      imageUrl: `/thumbnail/${photo.facilityCode}/photo/${photo.createdBy}/${photo.photoId}.webp`,
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
    JSON.stringify(dataObj),
  );

  // 6. アルバム情報を更新（販売中に変更）
  await Album.actionSalesPublished(
    data.facilityCode,
    data.albumId,
    photosObj.length,
    data.userId,
  );

  // // 7 写真を販売実績アリへと変更
  // await Photo.setFirstSoldAt(data.facilityCode, photoIds);

  // 7. ナナポケへの通知が必要な場合は通知 ※データをS3Eventトリガー経由で送信
  if (album.topicsSend) {
    console.log("album.topicsSend", album.topicsSend);
  }
};
