import * as http from "../http";
import {AppConfig, AlbumConfig} from "../config";

import {S3PutObjectSignedUrl} from "../utils/S3";

import {parseOrThrow} from "../libs/validate";
import {AlbumPathParameters, ResultOK} from "../schemas/public";

import * as Album from "../utils/Dynamo/Album";
import * as Photo from "../utils/Dynamo/Photo";
import * as Relation from "../utils/Dynamo/Relation";

import {truncateSafe} from "../libs/tool";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータのアルバムID
  const path = parseOrThrow(AlbumPathParameters, event.pathParameters ?? {});

  // 1. 対象のアルバムを取得
  const origin = await Album.get(authContext.facilityCode, path.albumId);
  console.log("origin", origin);

  // 販売終了しているもの以外は不可とする
  if (
    origin.salesStatus === AlbumConfig.SALES_STATUS.DRAFT ||
    origin.salesStatus === AlbumConfig.SALES_STATUS.PUBLISHING ||
    (origin.salesStatus === AlbumConfig.SALES_STATUS.PUBLISHED &&
      origin.salesPeriod.end > new Date().toISOString())
  ) {
    return http.badRequest({
      message: `このアルバムは販売中なので再販は実施できません`,
    });
  }

  // 2. DynamoDB に Album を作成
  const album = await Album.create(
    authContext.facilityCode,
    authContext.userId,
    truncateSafe(`（再販）${origin.title}`),
    "",
    AlbumConfig.PRICE_TABLE.PREMIUM,
    {start: "", end: ""},
    AlbumConfig.IMAGE_STATUS.NONE,
  );

  // 3. コピー
  // コピー元のアルバムに属する写真一覧を取得
  const photoIds = await Relation.getPhotoIdsByAlbumId(
    authContext.facilityCode,
    origin.albumId,
  );

  // DynamoDB に写真とアルバムの紐付け情報を登録
  for (const photoId of photoIds) {
    await Relation.setRelationPhotoAlbums({
      facilityCode: authContext.facilityCode,
      photoId: photoId,
      addAlbums: [album.albumId],
      delAlbums: [],
      userId: authContext.userId,
    });
  }

  return http.ok(parseOrThrow(ResultOK, {ok: true}));
});
