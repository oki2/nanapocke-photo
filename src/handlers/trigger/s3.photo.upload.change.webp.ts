import {StorageClass} from "@aws-sdk/client-s3";
import {EventBridgeHandler} from "aws-lambda";

import {AppConfig, PhotoConfig} from "../../config";
import {S3FileReadToByteArray, S3FilePut, S3FileCopy} from "../../utils/S3";
import * as Photo from "../../utils/Dynamo/Photo";

import sharp from "sharp";
import ExifReader from "exifreader";
import {lightFormat} from "date-fns";

import {PhotoConvertResizeSet} from "../../utils/ImageConvert";

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
    // 画像変換して保存まで実行
    await PhotoConvertResizeSet(
      bucketName,
      keyPath,
      facilityCode,
      userId,
      photoId
    );
  } catch (err) {
    console.error(err);
  }
};
