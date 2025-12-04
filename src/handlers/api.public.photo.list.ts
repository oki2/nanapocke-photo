import * as http from "../http";

import {PhotoListResponse, PhotoListResponseT} from "../schemas/photo";
import {parseOrThrow} from "../libs/validate";

import * as Photo from "../utils/Dynamo/Photo";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);
  // データの取得
  const data = await Photo.list(authContext.facilityCode);
  console.log("data", data);

  const result: PhotoListResponseT = [];

  for (const item of data) {
    result.push({
      facilityCode: item.facilityCode,
      photoId: item.photoId,
      seq: item.seq,
      status: item.status,
      tags: item.tags,
      valueType: item.valueType,
      shootingAt: item.shootingAt,
      createdAt: item.createdAt,
    });
  }

  const tmp = parseOrThrow(PhotoListResponse, result);
  console.log("tmp", tmp);
  return http.ok(tmp);
});
