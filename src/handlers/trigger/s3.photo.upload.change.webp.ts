import {StorageClass} from "@aws-sdk/client-s3";
import {EventBridgeHandler} from "aws-lambda";

import {AppConfig} from "../../config";
import {S3FileReadToByteArray, S3FilePut, S3FileCopy} from "../../utils/S3";
import * as Photo from "../../utils/Dynamo/Photo";

import sharp from "sharp";
import ExifReader from "exifreader";
import {lightFormat} from "date-fns";

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
  const [prefix, facilityCode, userId, photoId, fileName] = keyPath.split("/");

  console.log("keyPath", keyPath);

  try {
    // 対象の画像をS3から取得
    const byteAry = await S3FileReadToByteArray(bucketName, keyPath);

    // 写真の情報を取得
    const photo = await Photo.get(facilityCode, photoId);
    if (!photo) {
      console.error("写真情報が取得できません");
      return;
    }

    // 撮影日時をDBから取得（タイムゾーンはUTC）
    const tmpShootingDate = new Date(photo?.shootingAt ?? Date.now());
    // Exif に書き込む日時を計算（タイムゾーンはJST）
    tmpShootingDate.setHours(tmpShootingDate.getHours() + 9);

    // データを準備
    const orgImg = sharp(byteAry);
    const meta = await orgImg.metadata();
    console.log("meta", meta.exif);

    // 写真の撮影日時を取得、無い場合は指定した撮影日時を使用
    const DateTime =
      (await getDateTimeExif(byteAry)) ??
      lightFormat(tmpShootingDate, "yyyy:MM:dd HH:mm:ss");
    console.log("DateTime", DateTime);

    // 撮影日時をDate型に変換
    const shootingAt = new Date(
      DateTime.replace(
        /^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/,
        "$1-$2-$3T$4"
      )
    );
    // UTCに変換
    shootingAt.setHours(shootingAt.getHours() - 9);
    console.log("shootingAt", shootingAt);

    // ============================================================
    // 1. webp へ変換 100px x 100px に縮小 =====
    const webpImg = orgImg.clone();
    let webpBf: Buffer;
    webpBf = await webpImg
      .rotate()
      .resize({
        width: 600,
        height: 600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .composite([{input: "watermark.png", tile: true}])
      .toFormat("webp", {quality: 80})
      .toBuffer();

    const webpKeyPath = `thumbnail/${facilityCode}/${userId}/${photoId}.webp`;
    await S3FilePut(
      AppConfig.BUCKET_PHOTO_NAME,
      webpKeyPath,
      webpBf,
      "image/webp"
    );

    // ============================================================
    // 2. DL用画像 =====
    const Copyright = `nanapocke photo ${facilityCode}`;
    const dlBf = await orgImg
      .clone()
      .rotate()
      .jpeg({quality: 100, chromaSubsampling: "4:4:4"})
      .toBuffer();

    // Exifデータ埋め込み ===================
    const allDate = {
      DateCreated: DateTime,
      DateTimeCreated: DateTime,
      DateTimeOriginal: DateTime,
      DateTimeDigitized: DateTime,
      CreateDate: DateTime,
    };
    const ExifData = {
      exif: {
        IFD0: {Copyright, DateTime, ...allDate},
        IFD1: {Copyright, DateTime, ...allDate},
        IFD2: {Copyright, DateTime, ...allDate},
        IFD3: {Copyright, DateTime, ...allDate},
        IFD4: {Copyright, DateTime, ...allDate},
      },
    };
    const finalBuffer = await sharp(dlBf).withMetadata(ExifData).toBuffer();
    await S3FilePut(
      AppConfig.BUCKET_PHOTO_NAME,
      `storage/${facilityCode}/${userId}/${photoId}/${photo?.seq}-dl.jpg`,
      finalBuffer,
      "image/jpeg",
      StorageClass.STANDARD_IA
    );

    // ============================================================
    // 3. 印刷L画像 1051 x 1500 以上
    if (
      (meta.width >= 1051 && meta.height >= 1500) ||
      (meta.width >= 1500 && meta.height >= 1051)
    ) {
      let width = 1051;
      let height = 1500;
      if (meta.width > meta.height) {
        width = 1500;
        height = 1051;
      }
      const plBf = await orgImg
        .clone()
        .rotate()
        .resize({
          width: width,
          height: height,
          fit: "outside",
          withoutEnlargement: true,
        })
        .jpeg()
        .toBuffer();

      await S3FilePut(
        AppConfig.BUCKET_PHOTO_NAME,
        `storage/${facilityCode}/${userId}/${photoId}/${photo?.seq}-printl.jpg`,
        plBf,
        "image/jpeg",
        StorageClass.STANDARD_IA
      );
    }

    // ============================================================
    // 4. 印刷2L画像 1500 x 2102 以上
    if (
      (meta.width >= 2102 && meta.height >= 1500) ||
      (meta.width >= 1500 && meta.height >= 2102)
    ) {
      let width = 1500;
      let height = 2102;
      if (meta.width > meta.height) {
        width = 2102;
        height = 1500;
      }
      const p2lBf = await orgImg
        .clone()
        .rotate()
        .resize({
          width: width,
          height: height,
          fit: "outside",
          withoutEnlargement: true,
        })
        .jpeg()
        .toBuffer();

      await S3FilePut(
        AppConfig.BUCKET_PHOTO_NAME,
        `storage/${facilityCode}/${userId}/${photoId}/${photo?.seq}-print2l.jpg`,
        p2lBf,
        "image/jpeg",
        StorageClass.STANDARD_IA
      );
    }

    // ============================================================
    // 5. オリジナル画像をコピー
    await S3FileCopy(
      bucketName,
      keyPath,
      AppConfig.BUCKET_PHOTO_NAME,
      `original/${facilityCode}/${userId}/${photoId}`,
      StorageClass.GLACIER_IR
    );

    const shootingAtISO = shootingAt.toISOString();

    // ============================================================
    // 6. 画像変換完了したら、DynamoDBにデータ保存
    await Photo.setPhotoMeta(
      facilityCode,
      photoId,
      `EDITABLE#${photo.createdAt}#${photoId}`,
      `EDITABLE#${shootingAtISO}#${photoId}`,
      meta.width,
      meta.height,
      shootingAtISO
    );

    // ============================================================
    // 7. アルバム指定がある場合は、写真とアルバムの紐付け情報を登録
    if (photo.albums.length > 0) {
      const tmp = await Photo.setAlbums(
        facilityCode,
        photoId,
        photo.albums,
        [],
        photo.albums,
        photo.createdBy
      );
      console.log("tmp", tmp);
    }
  } catch (err) {
    console.error(err);
  }
};

async function getDateTimeExif(
  byteAry: Uint8Array<ArrayBufferLike>
): Promise<string | undefined> {
  try {
    const buffer = byteAry.buffer.slice(
      byteAry.byteOffset,
      byteAry.byteOffset + byteAry.byteLength
    );

    const tags = ExifReader.load(buffer, {expanded: true});

    return (
      tags.exif?.DateTimeOriginal?.description ||
      tags.exif?.DateTimeDigitized?.description ||
      undefined
    );
  } catch (error) {
    return undefined;
  }
}
