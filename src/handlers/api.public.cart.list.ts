import {AppConfig} from "../config";
import * as http from "../http";
import {parseOrThrow} from "../libs/validate";
import {CartItemList, CartItemListT} from "../schemas/public";

import * as Cart from "../utils/Dynamo/Cart";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // 1. 現在のカートの中身を取得
  const cart = await Cart.list(authContext.facilityCode, authContext.userId);
  console.log("cart", cart);

  // 2. レスポンス形式に変換
  const response: CartItemListT = cart.map((item: any) => {
    return {
      albumId: item.albumId,
      photoId: item.photoId,
      albumTitle: item.albumTitle,
      albumSequenceId: item.albumSequenceId,
      photoSequenceId: item.photoSequenceId,
      priceTier: item.priceTier,
      purchaseDeadline: item.purchaseDeadline,
      download: [item.downloadOption],
      print: [item.printLOption, item.print2LOption],
    };
  });

  return http.ok(parseOrThrow(CartItemList, response));
});
