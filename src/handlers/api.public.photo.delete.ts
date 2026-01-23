import {AppConfig, PhotoConfig} from "../config";
import * as http from "../http";
import {PhotoPathParameters, ResultOK} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Photo from "../utils/Dynamo/Photo";

import {S3FileCopy} from "../utils/S3";

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

  // 2. 写真のステータスを論理削除へ変更
  await Photo.photoManualDelete(
    authContext.facilityCode,
    path.photoId,
    authContext.userId,
  );

  // 3. S3の写真をNoImage画像へ差し替え
  await S3FileCopy(
    AppConfig.BUCKET_PHOTO_NAME,
    `assets/no-image.webp`,
    AppConfig.BUCKET_PHOTO_NAME,
    `thumbnail/${authContext.facilityCode}/photo/${photo.createdBy}/${photo.photoId}.webp`,
  );

  // 4. レスポンス
  return http.ok(parseOrThrow(ResultOK, {ok: true}));
});
