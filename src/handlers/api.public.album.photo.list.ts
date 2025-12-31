import * as http from "../http";

import {AppConfig, AlbumConfig} from "../config";
import {AlbumPathParameters} from "../schemas/album";
import {parseOrThrow} from "../libs/validate";

import * as Album from "../utils/Dynamo/Album";

import {S3FileReadToString} from "../utils/S3";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータのアルバムID
  const path = parseOrThrow(AlbumPathParameters, event.pathParameters ?? {});

  // 施設コードのチェック、保護者用のAuthorizerはパスパラメータとのチェックを行わないのでこちらで判定
  if (path.facilityCode !== authContext.facilityCode) {
    return http.forbidden();
  }

  // 1. アルバム情報の取得
  const album = await Album.get(authContext.facilityCode, path.albumId);
  console.log("album", album);

  // 2. 現在アルバムが販売中かチェック
  const nowISOString = new Date().toISOString();
  if (
    album.salesStatus !== AlbumConfig.SALES_STATUS.PUBLISHED ||
    album.nbf > nowISOString ||
    album.exp < nowISOString
  ) {
    return http.forbidden();
  }

  // 3. S3から対象のファイルを取得
  const salesObj = JSON.parse(
    await S3FileReadToString(
      AppConfig.BUCKET_PHOTO_NAME,
      `sales/${authContext.facilityCode}/${path.albumId}.json`
    )
  );
  console.log("salesObj", salesObj);

  return http.ok(salesObj);

  // return http.ok(
  //   parseOrThrow(AlbumCreateResponse, {
  //     albumId: path.albumId,
  //     title: data.title,
  //   })
  // );
});
