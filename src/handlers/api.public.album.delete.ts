import * as http from "../http";

import {AppConfig, AlbumConfig} from "../config";
import {ResultOK, AlbumPathParameters} from "../schemas/public";

import {parseOrThrow} from "../libs/validate";

import * as Album from "../utils/Dynamo/Album";

import {S3DirectoryDelete} from "../utils/S3";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータのアルバムID
  const path = parseOrThrow(AlbumPathParameters, event.pathParameters ?? {});

  // アルバム情報を取得
  const album = await Album.get(authContext.facilityCode, path.albumId);
  console.log("album", album);
  // 販売開始へ変更する場合は、アルバムの販売ステータスが DRAFT 以外の場合は不可
  if (
    album.salesStatus === AlbumConfig.SALES_STATUS.PUBLISHING ||
    album.salesStatus === AlbumConfig.SALES_STATUS.PUBLISHED
  ) {
    return http.badRequest({
      message: `このアルバムは販売中なので削除することはできません`,
    });
  }

  // 2. Albumデータを削除
  await Album.purge(authContext.facilityCode, path.albumId);

  // 3. アルバム画像が存在する場合削除
  await S3DirectoryDelete(
    AppConfig.BUCKET_PHOTO_NAME,
    `thumbnail/${authContext.facilityCode}/album/${path.albumId}/`,
  );

  return http.ok(parseOrThrow(ResultOK, {ok: true}));
});
