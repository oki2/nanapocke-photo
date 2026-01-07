import * as SqsBase from "./Base";
import {AppConfig} from "../../config";

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
