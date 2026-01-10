import * as http from "../http";
import {AppConfig} from "../config";

import {S3PutObjectSignedUrl} from "../utils/S3";

import {parseOrThrow} from "../libs/validate";
import {
  AlbumCreateBody,
  AlbumCreateResponse,
  AlbumCreateResponseT,
} from "../schemas/public";

import * as Album from "../utils/Dynamo/Album";
import * as Photo from "../utils/Dynamo/Photo";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(AlbumCreateBody, raw);
  console.log("data", data);

  // 2. DynamoDB に Album を作成
  const album = await Album.create(
    authContext.facilityCode,
    authContext.userId,
    data.title,
    data.description ?? "",
    data.priceTable,
    data.salesPeriod
  );

  const result: AlbumCreateResponseT = {
    albumId: album.albumId,
    title: album.title,
  };

  // 3. コピーの場合
  if (data.copyFromAlbumId) {
    // コピー元のアルバムに属する写真一覧を取得
    const photoIds = await Photo.photoIdsByAlbumId(
      authContext.facilityCode,
      data.copyFromAlbumId
    );

    // DynamoDB に写真とアルバムの紐付け情報を登録
    for (const photoId of photoIds) {
      await Photo.setAlbums(
        authContext.facilityCode,
        photoId,
        [album.albumId],
        [],
        [album.albumId],
        authContext.userId
      );
    }
  }

  // 4. アルバム画像が存在する場合は、署名付きURLの発行 アップロードはPUTのみに絞るため、S3署名付きURLでのアップロードを行う
  if (data.coverImageFileName) {
    result.url = await S3PutObjectSignedUrl(
      AppConfig.BUCKET_UPLOAD_NAME,
      `${AppConfig.S3.PREFIX.ALBUM_IMAGE_UPLOAD}/${authContext.facilityCode}/${album.albumId}/${authContext.userId}/${data.coverImageFileName}`,
      60 // 即時アップされる想定なので、有効期限を短く1分とする
    );
  }

  return http.ok(parseOrThrow(AlbumCreateResponse, result));
});
