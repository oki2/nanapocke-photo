import {S3Client, GetObjectCommand} from "@aws-sdk/client-s3";
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
import * as User from "../../utils/Dynamo/User";

import {Upload} from "@aws-sdk/lib-storage";
import archiver from "archiver";
import {PassThrough} from "stream";

import * as NanapockeTopics from "../../utils/External/Nanapocke/Topics";

const s3 = new S3Client({region: process.env.AWS_REGION});

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

  // DL有効期限
  const expired = Payment.getDownloadExpiresAtDate(
    new Date(payment.smbcProcessDate),
  );
  // DL有効期限の日付、yyyy/mm/dd 形式の文字列に変換
  const endJstStr = expired.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  });

  // 注文データをS3のストレージ領域へコピー
  await S3.S3FileCopy(
    bucketName,
    keyPath,
    AppConfig.BUCKET_PHOTO_NAME,
    `paymentLog/${payment.userId}/${orderData.orderId}/order.json`,
  );

  // DL用
  type DlData = {
    photoId: string;
    photoSequenceId: number;
    shootingBy: string;
  };
  const dlData: DlData[] = orderData.cart
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
  const dlPhotoFiles: ZipInputFile[] = [];
  if (dlData.length > 0) {
    for (const data of dlData) {
      // 写真コピー
      const zipPath = `${data.photoSequenceId}-${PhotoConfig.PHOTO_SIZE_SUFFIX.DL_ORIGINAL}.jpg`;
      const photoKey = `storage/photo/${payment.facilityCode}/${data.shootingBy}/${data.photoId}/${zipPath}`;
      await S3.S3FileCopy(
        AppConfig.BUCKET_PHOTO_NAME,
        photoKey,
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
      dlPhotoFiles.push({
        key: photoKey,
        zipPath: zipPath,
      });

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

    console.log("=== DL用のレコード登録開始 ===");

    // DL用のレコードを登録
    await Photo.setDownloadAceptPhoto(
      payment.facilityCode,
      payment.userId,
      dlData.map((data) => {
        return data.photoId;
      }),
      payment.smbcProcessDate,
      expired.toISOString(),
    );
  }
  // 印刷購入が存在する場合は、サムネイルのみ作成
  if (printData.length > 0) {
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

  // DL購入数が規定枚数以上の場合、ZIP作成
  if (PaymentConfig.zipCreateCheck(dlData.length)) {
    const result = await createZipToS3({
      s3,
      sourceBucket: AppConfig.BUCKET_PHOTO_NAME,
      files: dlPhotoFiles,
      destinationBucket: AppConfig.BUCKET_LIBRARY_NAME,
      destinationKey: Photo.userLibraryZip(
        payment.userId,
        payment.facilityCode,
        orderData.orderId,
      ),
      // contentDisposition: `attachment; filename="${orderData.orderId}.zip"`,
      // metadata: {createdBy: "lambda"},
    });
    await Payment.setZipDownloadInfo(orderData.orderId, result.key);
  }

  // DL購入がある場合、最後にナナポケ通知を送る
  if (dlData.length > 0) {
    const userInfo = await User.get(payment.userId);
    // DL期限3日前の通知
    await NanapockeTopics.SendUser({
      nurseryCd: payment.facilityCode,
      childrenList: [userInfo.userCode],
      noticeTitle: "あと3日でダウンロード期限が切れる写真があります",
      noticeContent: `ダウンロード期限は${endJstStr}までです。<a href="https://${AppConfig.NANAPHOTO_FQDN}/member/orders/${orderData.orderId}">こちらから</a>お早めにダウンロードしてください。`,
      noticeSendTime: NanapockeTopics.toNanapockeSendTimeFormat(
        NanapockeTopics.toJstDateAtHour(expired, 12, -3), // DL期限を0日とするため、 2日前となる
      ),
    });

    // DL期限当日の通知
    await NanapockeTopics.SendUser({
      nurseryCd: payment.facilityCode,
      childrenList: [userInfo.userCode],
      noticeTitle: "本日ダウンロード期限が切れる写真があります",
      noticeContent: `忘れずに<a href="https://${AppConfig.NANAPHOTO_FQDN}/member/orders/${orderData.orderId}">こちらから</a>ダウンロードしてください。`,
      noticeSendTime: NanapockeTopics.toNanapockeSendTimeFormat(
        NanapockeTopics.toJstDateAtHour(expired, 20, -1),
      ),
    });
  }

  console.log("orderData", orderData);
};

// === zip ==================================

export type ZipInputFile = {
  key: string; // S3キー
  zipPath?: string; // ZIP内のパス（省略時は key の末尾ファイル名）
};

export type CreateZipToS3Params = {
  s3: S3Client;

  sourceBucket: string;
  files: ZipInputFile[];

  destinationBucket: string;
  destinationKey: string;

  // オプション
  compressionLevel?: number; // 0-9 (default: 9)
  contentDisposition?: string; // 例: attachment; filename="photos.zip"
  metadata?: Record<string, string>;
};

/**
 * S3上の複数ファイルをストリーミングでZIP化し、そのままS3へ保存します。
 * - メモリにZIP全体を載せません
 * - /tmpも使いません
 */
export async function createZipToS3(params: CreateZipToS3Params): Promise<{
  bucket: string;
  key: string;
  s3Uri: string;
}> {
  const {
    s3,
    sourceBucket,
    files,
    destinationBucket,
    destinationKey,
    compressionLevel = 9,
    contentDisposition,
    metadata,
  } = params;

  if (!files?.length) {
    throw new Error("files must not be empty");
  }

  // ZIP出力（→S3 multipart uploadに流す）
  const zipStream = new PassThrough();

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: destinationBucket,
      Key: destinationKey,
      Body: zipStream,
      ContentType: "application/zip",
      Tagging: ApplicationConfig.S3_LIFECYCLE_TAG.DL_PHOTO_DELETE,
      ...(contentDisposition ? {ContentDisposition: contentDisposition} : {}),
      ...(metadata ? {Metadata: metadata} : {}),
    },
  });

  // 進捗ログ（不要なら削除OK）
  upload.on("httpUploadProgress", (p) => console.log("zip upload", p));

  const archive = archiver("zip", {zlib: {level: compressionLevel}});
  archive.on("warning", (err) => console.warn("archiver warning", err));
  archive.on("error", (err) => {
    // archiverエラーはupload側にも伝播させたいのでstreamを壊す
    zipStream.destroy(err);
  });

  archive.pipe(zipStream);

  for (const f of files) {
    const zipPath = f.zipPath ?? guessZipPathFromKey(f.key);

    const obj = await s3.send(
      new GetObjectCommand({
        Bucket: sourceBucket,
        Key: f.key,
      }),
    );

    if (!obj.Body) {
      throw new Error(`Empty S3 object body: s3://${sourceBucket}/${f.key}`);
    }

    // S3のBody(Readable)をそのままZIPにappend
    archive.append(obj.Body as any, {name: zipPath});
  }

  await archive.finalize();
  await upload.done();

  return {
    bucket: destinationBucket,
    key: destinationKey,
    s3Uri: `s3://${destinationBucket}/${destinationKey}`,
  };
}

function guessZipPathFromKey(key: string): string {
  // "a/b/c.jpg" -> "c.jpg"
  const parts = key.split("/");
  const last = parts[parts.length - 1];
  return last || "file";
}
