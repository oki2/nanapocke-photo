import {StorageClass} from "@aws-sdk/client-s3";
import {EventBridgeHandler} from "aws-lambda";

import {AppConfig, PhotoConfig} from "../../config";
import {S3FileReadToByteArray, S3FilePut, S3FileCopy} from "../../utils/S3";
import * as Album from "../../utils/Dynamo/Album";

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
  const [prefix, facilityCode, albumId, userId, fileName] = keyPath.split("/");

  console.log("keyPath", keyPath);

  try {
    // ============================================================
    // 1. 対象の画像をS3から取得
    const byteAry = await S3FileReadToByteArray(bucketName, keyPath);

    // ============================================================
    // 2. webp へ変換 横幅を414px に縮小 =====
    const webpImg = sharp(byteAry);
    let webpBf: Buffer;
    webpBf = await webpImg
      .rotate()
      .resize({
        width: 414,
        height: 414,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFormat("webp", {quality: 80})
      .toBuffer();

    // ============================================================
    // 3. S3へ保存 =====
    const imageName = Date.now().toString() + ".webp";
    const webpKeyPath = `thumbnail/${facilityCode}/album/${albumId}/${imageName}`;
    await S3FilePut(
      AppConfig.BUCKET_PHOTO_NAME,
      webpKeyPath,
      webpBf,
      "image/webp"
    );

    // ============================================================
    // 4. 画像変換完了したら、DynamoDBにデータ保存
    await Album.setAlbumImage(facilityCode, albumId, imageName, userId);
  } catch (err) {
    console.error(err);
  }
};
