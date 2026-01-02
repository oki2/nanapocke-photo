import * as S3Base from "./Base";
import {AppConfig} from "../../config";
import {TRIGGER_ACTION} from "../../schemas/trigger.s3.action.router";

export async function saveOrderData(
  orderId: string,
  orderData: object
): Promise<void> {
  await S3Base.S3FilePut(
    AppConfig.BUCKET_UPLOAD_NAME,
    `order/${orderId}/order.json`,
    JSON.stringify(orderData)
  );
}

export async function saveUserInfo(
  orderId: string,
  address: object
): Promise<void> {
  await S3Base.S3FilePut(
    AppConfig.BUCKET_UPLOAD_NAME,
    `order/${orderId}/userInfo.json`,
    JSON.stringify(address)
  );
}

export async function paymentComplete(orderId: string): Promise<void> {
  await S3Base.S3FileCopy(
    AppConfig.BUCKET_UPLOAD_NAME,
    `order/${orderId}/order.json`,
    AppConfig.BUCKET_UPLOAD_NAME,
    `action/${TRIGGER_ACTION.PAYMENT_COMPLETE}/order/${orderId}/order.json`
  );
}
