import * as SqsBase from "./Base";
import {AppConfig} from "../../config";
import {Bucket} from "aws-cdk-lib/aws-s3";

/**
 * SQSへメッセージ送信
 * 印刷データ送信JOB
 *
 * @param {string} orderId - Order ID.
 *
 * @returns {Promise<void>} - Promise of void.
 */
export async function sendPhotoFileByOrderId(orderId: string): Promise<void> {
  await SqsBase.SqsSendMessage(
    AppConfig.SQS_QUEUE_URL_MAIN,
    {},
    JSON.stringify({
      job: AppConfig.SQS_JOB_SEND_PHOTO_FILE_BY_ORDERID,
      data: {
        orderId: orderId,
      },
    }),
    0
  );
}

/**
 * SQSへメッセージ送信
 * 写真データUnZIP後の保存前処理JOB
 *
 * @param {string} bucketName - S3バケット名
 * @param {string[]} keyPathList - S3のZIPファイルパス
 *
 * @returns {Promise<void>} - Promise of void.
 */
export async function sendPhotoUnzipBeforeSave(
  bucketName: string,
  keyPathList: string[]
): Promise<void> {
  //

  await SqsBase.SqsSendMessageList(
    AppConfig.SQS_QUEUE_URL_PHOTO_CONVERT,
    keyPathList.map(
      (keyPath) =>
        JSON.stringify({
          job: AppConfig.SQS_JOB_PHOTO_UNZIP_BEFORE_SAVE,
          data: {
            bucketName: bucketName,
            keyPath: keyPath,
          },
        }),
      0
    )
  );
}
