import * as http from "../http";
import {PhotoConfig} from "../config";
import {
  PhotoSelectMy,
  PhotoListResponse,
  PhotoListResponseT,
} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";
import * as Photo from "../utils/Dynamo/Photo";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // 1. クエリストリングチェック =========== //
  const query = parseOrThrow(PhotoSelectMy, event.queryStringParameters ?? {});
  console.log("query", query);

  // 2. 写真一覧取得
  const data = await Photo.myList(
    authContext.facilityCode,
    authContext.userId,
    query.cursor,
  );
  console.log("data", data);

  const result: PhotoListResponseT = {
    photos: [],
    totalItems: 0,
    nextCursor: "",
  };

  for (const item of data.photos) {
    result.photos.push({
      facilityCode: item.facilityCode,
      photoId: item.photoId,
      sequenceId: Number(item.sequenceId),
      status: item.status,
      saleStatus:
        item.status == PhotoConfig.STATUS.ACTIVE
          ? PhotoConfig.SALES_STATUS.EDITABLE
          : PhotoConfig.SALES_STATUS.LOCKED,
      photoImageUrl: `/thumbnail/${item.facilityCode}/photo/${item.createdBy}/${item.photoId}.webp`,
      size: `${item.width} x ${item.height} px`,
      printSizes: item.salesSizePrint.map((v: string) => {
        if (v === PhotoConfig.SALES_SIZE.PRINT_L) return "L";
        if (v === PhotoConfig.SALES_SIZE.PRINT_2L) return "2L";
        return null; // 何も該当しない場合
      }),
      tags: item.tags,
      albums: item.albums,
      priceTier: item.priceTier,
      shootingAt: item.shootingAt,
      shootingUserName: item.shootingUserName,
      createdAt: item.createdAt,
    });
  }
  result.totalItems = data.totalItems;
  result.nextCursor = data.nextCursor ?? "";

  return http.ok(parseOrThrow(PhotoListResponse, result));
});
