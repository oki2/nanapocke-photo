import {PaymentConfig} from "../../../config";
import * as PaymentModel from "./Model";
import {nextUtc17} from "../../../libs/tool";

export const getDownloadExpiresAt = (date: Date = new Date()): string => {
  date.setDate(date.getDate() + PaymentConfig.PHOTO_DOWNLOAD_EXPIRES_DAYS);
  return nextUtc17(date).toISOString().replace(".000", "");
};
