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

import * as NanapockeTopics from "../../utils/External/Nanapocke/Topics";

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
  type SizeKey = keyof typeof PhotoConfig.SALES_SIZE;
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
            PriceConfig.PHOTO_PRICE[album.priceTable][photo.priceTier][
              size as SizeKey
            ],
        };
      }),
      salesSizePrint: photo.salesSizePrint.map((size) => {
        return {
          size: size,
          price:
            PriceConfig.PHOTO_PRICE[album.priceTable][photo.priceTier][
              size as SizeKey
            ],
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
    cover: {
      imageStatus: album.coverImageStatus ?? AlbumConfig.IMAGE_STATUS.NONE,
      imageUrl:
        album.coverImageStatus === AlbumConfig.IMAGE_STATUS.VALID &&
        album.coverImage
          ? `/thumbnail/${album.facilityCode}/album/${album.albumId}/${album.coverImage}`
          : "",
    },
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

  // 7. ナナポケへの通知が必要な場合は通知
  if (album.topicsSend) {
    console.log("album.topicsSend", album.topicsSend);

    const now = new Date().getTime(); // 現在日時のタイムスタンプ
    const start = NanapockeTopics.toJstDateAtHour(album.salesPeriod.start, 20); // 販売開始日時
    const end3 = NanapockeTopics.toJstDateAtHour(album.salesPeriod.end, 12, -4); // 販売終了日時 3日前 販売終了は内部的に翌日 2:00 なので、もう一日マイナスする
    const end = NanapockeTopics.toJstDateAtHour(album.salesPeriod.end, 20, -1); // 販売終了日時 販売終了は内部的に翌日 2:00 なので、もう一日マイナスする

    // 販売終了日の日付、yyyy/mm/dd 形式の文字列に変換
    const endJstStr = end.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
    });

    // 販売開始のTopics送信 ================================
    const noticeContent: Album.NanapockeTopicsT = {
      facilityCode: data.facilityCode,
      albumId: data.albumId,
    };
    if (now < start.getTime()) {
      // 7.1.1 販売開始前の場合は未来日を指定
      noticeContent.startNotice = {
        noticeId: await NanapockeTopics.SendClass({
          nurseryCd: album.facilityCode,
          classReceivedList: album.topicsClassReceivedList,
          academicYear: album.topicsAcademicYear,
          noticeTitle: "新しいアルバムの販売が開始されました",
          noticeContent: `新しいアルバム<a href="https://${AppConfig.NANAPHOTO_FQDN}/member/albums/${album.albumId}">${album.title}</a>の販売が開始されました。販売期限は${endJstStr}までです。お早めにお買い求めください。`,
          noticeSendTime: NanapockeTopics.toNanapockeSendTimeFormat(start),
        }),
        sendAt: start.toISOString(),
      };
    } else {
      // 7.1.2 販売開始時刻を過ぎている場合は即時送信
      NanapockeTopics.SendClass({
        nurseryCd: album.facilityCode,
        classReceivedList: album.topicsClassReceivedList,
        academicYear: album.topicsAcademicYear,
        noticeTitle: "新しいアルバムの販売が開始されました",
        noticeContent: `新しいアルバム<a href="https://${AppConfig.NANAPHOTO_FQDN}/member/albums/${album.albumId}">${album.title}</a>の販売が開始されました。販売期限は${endJstStr}までです。お早めにお買い求めください。`,
      });
    }

    // 7.2 販売終了3日前の通知
    if (now < end3.getTime()) {
      noticeContent.end3Notice = {
        noticeId: await NanapockeTopics.SendClass({
          nurseryCd: album.facilityCode,
          classReceivedList: album.topicsClassReceivedList,
          academicYear: album.topicsAcademicYear,
          noticeTitle: "アルバムの販売終了3日前になりました",
          noticeContent: `アルバム<a href="https://${AppConfig.NANAPHOTO_FQDN}/member/albums/${album.albumId}">${album.title}</a>の終了3日前になりました。販売期限は${endJstStr}までです。お早めにお買い求めください。`,
          noticeSendTime: NanapockeTopics.toNanapockeSendTimeFormat(end3),
        }),
        sendAt: end3.toISOString(),
      };
    }

    // 7.4 販売終了日の通知
    if (now < end.getTime()) {
      noticeContent.endNotice = {
        noticeId: await NanapockeTopics.SendClass({
          nurseryCd: album.facilityCode,
          classReceivedList: album.topicsClassReceivedList,
          academicYear: album.topicsAcademicYear,
          noticeTitle: "本日で販売終了するアルバムがあります",
          noticeContent: `アルバム<a href="https://${AppConfig.NANAPHOTO_FQDN}/member/albums/${album.albumId}">${album.title}</a>の販売終了となります。お早めにお買い求めください。`,
          noticeSendTime: NanapockeTopics.toNanapockeSendTimeFormat(end),
        }),
        sendAt: end.toISOString(),
      };
    }

    // noticeIdsを保存
    await Album.setNanapockeTopicsIds(noticeContent);
  }
};
