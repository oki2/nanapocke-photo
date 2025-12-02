import {Setting} from "../../config";

import {EventBridgeHandler} from "aws-lambda";
import {S3FileReadToByteArray, S3FilePut, S3FileCopy} from "../../utils/S3";

import * as Photo from "../../utils/Dynamo/Photo";

import sharp from "sharp";
import {ConfigurationSetTlsPolicy} from "aws-cdk-lib/aws-ses";

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

    // データを準備
    const webpImg = sharp(byteAry);
    const meta = await webpImg.metadata();

    // webp へ変換 100px x 100px に縮小
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

    // 生成した画像を保存
    const webpKeyPath = `thumbnail/${facilityCode}/${userId}/${photoId}.webp`;
    await S3FilePut(
      Setting.BUCKET_PHOTO_NAME,
      webpKeyPath,
      webpBf,
      "image/webp"
    );

    // 画像をコピー
    await S3FileCopy(
      bucketName,
      keyPath,
      Setting.BUCKET_PHOTO_NAME,
      `original/${facilityCode}/${userId}/${photoId}`
    );

    // 画像変換完了したら、DynamoDBにデータ保存
    await Photo.setPhotoMeta(facilityCode, photoId, meta.width, meta.height);
  } catch (err) {
    console.error(err);
  }
};
