import {AppConfig} from "../config";
import * as http from "../http";
import {CartPhotoDeletePathParameters, ResultOK} from "../schemas/common";
import {CartEditBody} from "../schemas/cart";
import {parseOrThrow} from "../libs/validate";

import * as Cart from "../utils/Dynamo/Cart";
import * as Album from "../utils/Dynamo/Album";
import * as Photo from "../utils/Dynamo/Photo";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータの施設コード、写真ID取得
  const path = parseOrThrow(
    CartPhotoDeletePathParameters,
    event.pathParameters ?? {}
  );

  // 1. 削除の実行
  await Cart.photoDelete(
    authContext.facilityCode,
    authContext.userId,
    path.albumId,
    path.photoId
  );

  return http.ok(parseOrThrow(ResultOK, {ok: true}));
});
