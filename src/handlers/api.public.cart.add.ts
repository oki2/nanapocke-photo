import {AppConfig, AlbumConfig, PhotoConfig, PriceConfig} from "../config";
import * as http from "../http";
import {ResultOK} from "../schemas/common";
import {CartAddBody} from "../schemas/cart";
import {parseOrThrow} from "../libs/validate";

import * as Cart from "../utils/Dynamo/Cart";
import * as Album from "../utils/Dynamo/Album";
import * as Photo from "../utils/Dynamo/Photo";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // リクエストボディの確認
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(CartAddBody, raw);
  console.log("data", data);

  // 1. 対象の写真が対象のアルバムに設定されているかチェック
  const photoAlbum = await Photo.getPhotoByAlbumIdAndPhotoId(
    authContext.facilityCode,
    data.albumId,
    data.photoId
  );
  console.log("photoAlbum", photoAlbum);
  if (!photoAlbum) {
    return http.badRequest({detail: "販売されていません"});
  }

  // 2. アルバムのステータスチェック
  const album = await Album.get(authContext.facilityCode, data.albumId);
  console.log("album", album);
  if (
    !album ||
    album.salesStatus !== AlbumConfig.SALES_STATUS.PUBLISHED ||
    album.salesPeriod.end < new Date().toISOString()
  ) {
    return http.badRequest({detail: "現在対象のアルバムは販売されていません"});
  }

  // 3. 写真の情報を取得
  const photo = await Photo.get(authContext.facilityCode, data.photoId);
  console.log("photo", photo);
  if (!photo || photo.status !== PhotoConfig.STATUS.ACTIVE) {
    return http.badRequest({detail: "現在対象の写真は販売されていません"});
  }

  // 過去の購入履歴を確認

  // 4. サイズ別販売可否判定
  // Download
  const dlOption: any = {
    size: PhotoConfig.SALES_SIZE.DONWLOAD,
    purchasable: true, // Download 購入可能か
    note: `Size : ${photo.width} x ${photo.height}`, // 例: "5760 x 3840"
    unitPrice:
      PriceConfig.PHOTO_PRICE[album.priceTable][photo.priceTier][
        PhotoConfig.SALES_SIZE.DONWLOAD
      ], // 単価
    selected: false, // 購入有無
    // downloadable: false, // 現在DL可能か
    // purchasedAt: UtcIsoDateTimeString // 過去購入日（購入したことがある場合）
  };
  console.log("dlOption", dlOption);

  // Print-L
  const printLOption: Record<string, any> = (() => {
    if (photo.salesSizePrint.includes(PhotoConfig.SALES_SIZE.PRINT_L)) {
      return {
        size: PhotoConfig.SALES_SIZE.PRINT_L,
        purchasable: true, // 購入可能
        unitPrice:
          PriceConfig.PHOTO_PRICE[album.priceTable][photo.priceTier][
            PhotoConfig.SALES_SIZE.PRINT_L
          ], // 単価
        quantity: 0, // 枚数（ユーザー選択）
      };
    }
    return {
      size: PhotoConfig.SALES_SIZE.PRINT_L,
      purchasable: false, // 購入不可
    };
  })();
  console.log("printLOption", printLOption);

  // Print-2L
  const print2LOption: Record<string, any> = (() => {
    if (photo.salesSizePrint.includes(PhotoConfig.SALES_SIZE.PRINT_2L)) {
      return {
        size: PhotoConfig.SALES_SIZE.PRINT_2L,
        purchasable: true, // 購入可能
        unitPrice:
          PriceConfig.PHOTO_PRICE[album.priceTable][photo.priceTier][
            PhotoConfig.SALES_SIZE.PRINT_2L
          ], // 単価
        quantity: 0, // 枚数（ユーザー選択）
      };
    }
    return {
      size: PhotoConfig.SALES_SIZE.PRINT_2L,
      purchasable: false, // 購入不可
    };
  })();
  console.log("print2LOption", print2LOption);

  // 4. カートに追加
  await Cart.add(
    authContext.facilityCode,
    authContext.userId,
    data.albumId,
    data.photoId,
    {
      albumSequenceId: album.sequenceId,
      photoSequenceId: photo.sequenceId,
      albumTitle: album.title,
      purchaseDeadline: album.salesPeriod.end,
      priceTier: photo.priceTier,
      downloadOption: dlOption,
      printLOption: printLOption,
      print2LOption: print2LOption,
    }
  );

  return http.ok(parseOrThrow(ResultOK, {ok: true}));
});
