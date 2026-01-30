import * as S3Base from "./Base";
import {AppConfig} from "../../config";
import {TRIGGER_ACTION} from "../../schemas/trigger.s3.action.router";

import {ShippingAddressT} from "../../schemas/public";

export async function saveOrderData(
  orderId: string,
  orderData: object,
): Promise<void> {
  await S3Base.S3FilePut(
    AppConfig.BUCKET_UPLOAD_NAME,
    `order/${orderId}/order.json`,
    JSON.stringify(orderData),
  );
}

export async function getOrderData(
  orderId: string,
): Promise<Record<string, any>> {
  return JSON.parse(
    await S3Base.S3FileReadToString(
      AppConfig.BUCKET_UPLOAD_NAME,
      `order/${orderId}/order.json`,
    ),
  );
}

export async function saveUserInfo(
  orderId: string,
  address: object,
): Promise<void> {
  await S3Base.S3FilePut(
    AppConfig.BUCKET_UPLOAD_NAME,
    `order/${orderId}/userInfo.json`,
    JSON.stringify(address),
  );
}

export async function getUserInfo(orderId: string): Promise<ShippingAddressT> {
  return JSON.parse(
    await S3Base.S3FileReadToString(
      AppConfig.BUCKET_UPLOAD_NAME,
      `order/${orderId}/userInfo.json`,
    ),
  );
}

export async function paymentComplete(orderId: string): Promise<void> {
  await S3Base.S3FileCopy(
    AppConfig.BUCKET_UPLOAD_NAME,
    `order/${orderId}/order.json`,
    AppConfig.BUCKET_UPLOAD_NAME,
    `action/${TRIGGER_ACTION.PAYMENT_COMPLETE}/order/${orderId}/order.json`,
  );
}

export async function savePaymentLog(
  orderId: string,
  userId: string,
  logData: object,
): Promise<void> {
  await S3Base.S3FilePut(
    AppConfig.BUCKET_PHOTO_NAME,
    `paymentLog/${userId}/${orderId}/smbclog-${Date.now()}.json`,
    JSON.stringify(logData),
  );
}
