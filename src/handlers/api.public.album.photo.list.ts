import * as http from "../http";
import {AppConfig, AlbumConfig} from "../config";

import {AlbumPathParameters, AlbumPhotoListResponse} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Album from "../utils/Dynamo/Album";
import * as Photo from "../utils/Dynamo/Photo";

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
      `sales/${authContext.facilityCode}/${path.albumId}.json`,
    ),
  );
  console.log("salesObj", salesObj);

  // 4. photoId のリスト作成し、購入済みデータの取得
  const dlAccept = await Photo.getDownloadAceptList(
    authContext.facilityCode,
    authContext.userId,
    salesObj.photos.map((p: any) => p.photoId),
  );

  // 5. レスポンス形式に変換
  const res = {
    album: salesObj.album,
    photos: salesObj.photos.map((p: any) => {
      const dl = dlAccept.find((u) => u.photoId === p.photoId);
      return {
        ...p,
        downloadUrl:
          dl && dl.expiredAt > nowISOString
            ? `/${Photo.userLibraryPhoto(
                authContext.userId,
                authContext.facilityCode,
                authContext.userId,
                p.sequenceId,
              )}`
            : "",
      };
    }),
  };
  return http.ok(parseOrThrow(AlbumPhotoListResponse, res));
});
