import {AppConfig} from "../config";
import * as http from "../http";
import {parseOrThrow} from "../libs/validate";
import {CartItemList, CartItemListT} from "../schemas/public";

import * as Cart from "../utils/Dynamo/Cart";
import * as Photo from "../utils/Dynamo/Photo";
import * as Payment from "../utils/Dynamo/Payment";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // 1. 現在のカートの中身を取得
  const cart = await Cart.list(authContext.facilityCode, authContext.userId);
  console.log("cart", cart);

  // 2. photoId のリスト作成し、購入済みデータの取得
  const dlAccept = await Photo.getDownloadAceptList(
    authContext.facilityCode,
    authContext.userId,
    cart.map((item: any) => item.photoId),
  );

  // 3. レスポンス形式に変換
  const nowISOString = new Date().toISOString();
  const response: CartItemListT = {
    photos: cart.map((item: any) => {
      const dl = dlAccept.find((u) => u.photoId === item.photoId);
      if (dl) {
        item.downloadOption.purchasedAt = dl.purchasedAt;
        if (dl.expiredAt > nowISOString) {
          item.downloadOption.downloadable = true;
        }
      }

      return {
        albumId: item.albumId,
        photoId: item.photoId,
        albumTitle: item.albumTitle,
        albumSequenceId: item.albumSequenceId,
        photoSequenceId: item.photoSequenceId,
        imageUrl: `/thumbnail/${item.facilityCode}/photo/${item.shootingBy}/${item.photoId}.webp`,
        priceTier: item.priceTier,
        purchaseDeadline: item.purchaseDeadline,
        download: [item.downloadOption],
        print: [item.printLOption, item.print2LOption],
      };
    }),
    downloadExpiry: Payment.getDownloadExpiresAt(new Date()),
  };

  return http.ok(parseOrThrow(CartItemList, response));
});
