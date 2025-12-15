import * as http from "../http";

import {
  AlbumUpdateBody,
  AlbumPathParameters,
  AlbumCreateResponse,
} from "../schemas/album";
import {parseOrThrow} from "../libs/validate";

import * as Album from "../utils/Dynamo/Album";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータのアルバムID
  const path = parseOrThrow(AlbumPathParameters, event.pathParameters ?? {});

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(AlbumUpdateBody, raw);
  console.log("data", data);

  // 販売開始日・終了日の計算
  console.log("nbf", data.nbf);
  console.log("exp", data.exp);

  // 2. DynamoDB に Albumデータを更新
  await Album.update(
    authContext.facilityCode,
    path.albumId,
    authContext.userId,
    data.title,
    data.description ?? "",
    data.priceTable,
    data.nbf,
    data.exp
  );

  return http.ok(
    parseOrThrow(AlbumCreateResponse, {
      albumId: path.albumId,
      title: data.title,
    })
  );
});
