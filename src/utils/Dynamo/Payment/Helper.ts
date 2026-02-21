import {PaymentConfig} from "../../../config";
import * as PaymentModel from "./Model";
import {nextUtc17} from "../../../libs/tool";

export const getDownloadExpiresAt = (date: Date = new Date()): string => {
  date.setDate(date.getDate() + PaymentConfig.PHOTO_DOWNLOAD_EXPIRES_DAYS);

  // 日本時間の23:59:59 に合わせて作成する
  date.setHours(16, 59, 59, 0);

  return date.toISOString().replace(".000", "");
};

export const getDownloadExpiresAtDate = (date: Date = new Date()): Date => {
  date.setDate(date.getDate() + PaymentConfig.PHOTO_DOWNLOAD_EXPIRES_DAYS);

  // 日本時間の23:59:59 に合わせて作成する
  date.setHours(16, 59, 59, 0);

  return date;
};
