import type {SQSEvent, SQSRecord} from "aws-lambda";
import {AppConfig, PhotoConfig} from "../../config";

import {PhotoConvertResizeSet} from "../../utils/ImageConvert";

import * as Photo from "../../utils/Dynamo/Photo";

type PayloadT = {
  job: string;
  data: Record<string, any>;
};

export const handler = async (event: SQSEvent) => {
  // バッチで複数レコードが届く
  for (const record of event.Records) {
    await handleRecord(record);
  }
};

async function handleRecord(record: SQSRecord): Promise<void> {
  console.log("record", record);
  const payload: PayloadT = JSON.parse(record.body);
  console.log("payload", payload);

  switch (payload.job) {
    case AppConfig.SQS_JOB_PHOTO_UNZIP_BEFORE_SAVE:
      await SqsJobPhotoUnzipBeforeSave(payload.data);
      break;
  }

  // 例外を投げると、そのメッセージは再試行されます（最大受信回数超えでDLQへ）
}

async function SqsJobPhotoUnzipBeforeSave(data: Record<string, any>) {
  const bucketName = data.bucketName;
  const keyPath = data.keyPath;

  // keyPathを分解
  const [prefix, facilityCode, userId, zipId, fileName] = keyPath.split("/");

  // zip のMETA を取得
  const zipMeta = await Photo.getZipMeta(facilityCode, zipId);
  if (!zipMeta) {
    return;
  }

  // 写真情報を仮登録
  const photoId = await Photo.create(
    facilityCode,
    userId,
    zipMeta.shootingUserName,
    zipMeta.shootingAt,
    zipMeta.priceTier,
    zipMeta.tags,
    zipMeta.albums
  );

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
}
