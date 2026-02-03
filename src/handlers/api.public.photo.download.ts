import {AppConfig, PhotoConfig} from "../config";
import * as http from "../http";
import {PhotoPathParameters} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Photo from "../utils/Dynamo/Photo";

import {S3FileReadToByteArray} from "../utils/S3";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータの施設コード、写真ID取得
  const path = parseOrThrow(PhotoPathParameters, event.pathParameters ?? {});

  // 1. 写真のステータスチェック
  const photo = await Photo.get(authContext.facilityCode, path.photoId);
  console.log("photo", photo);
  if (
    !photo ||
    authContext.facilityCode !== photo.facilityCode ||
    photo.status !== PhotoConfig.STATUS.ACTIVE
  ) {
    return http.notFound();
  }

  // 2. S3から対象のファイルを取得
  const buffer = Buffer.from(
    await S3FileReadToByteArray(
      AppConfig.BUCKET_PHOTO_NAME,
      `storage/photo/${authContext.facilityCode}/${photo.createdBy}/${photo.photoId}/${photo.sequenceId}-${PhotoConfig.PHOTO_SIZE_SUFFIX.DL_ORIGINAL}.jpg`,
    ),
  );

  // 3. レスポンス
  return http.imageJpeg(buffer);
});
