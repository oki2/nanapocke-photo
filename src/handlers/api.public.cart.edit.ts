import {AppConfig} from "../config";
import * as http from "../http";
import {CartPathParameters, ResultOK} from "../schemas/common";
import {CartEditBody, CartEditT} from "../schemas/cart";
import {parseOrThrow} from "../libs/validate";

import * as Cart from "../utils/Dynamo/Cart";
import * as Album from "../utils/Dynamo/Album";
import * as Photo from "../utils/Dynamo/Photo";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータの施設コード、写真ID取得
  const path = parseOrThrow(CartPathParameters, event.pathParameters ?? {});

  // Request Bodyデータの確認・バリデーション
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(CartEditBody, raw);
  console.log("data", data);

  // 1. 現在のカートの中身を取得
  const cart = await Cart.list(authContext.facilityCode, authContext.userId);
  console.log("cart", cart);

  // 2. 更新情報を作成する
  const updateItems = mergePurchasableOptions(cart, data);
  console.log("updateItems", updateItems);

  // 3. カートの中身を更新する
  for (const item of updateItems) {
    await Cart.edit(
      authContext.facilityCode,
      authContext.userId,
      item.albumId,
      item.photoId,
      item.dl ?? undefined,
      item.printl ?? undefined,
      item.print2l ?? undefined
    );
  }

  return http.ok(parseOrThrow(ResultOK, {ok: true}));
});

type CartItem = {
  albumId: string;
  photoId: string;
  sk: string;
  printLOption?: {purchasable?: boolean; quantity?: number; unitPrice?: number};
  print2LOption?: {
    purchasable?: boolean;
    quantity?: number;
    unitPrice?: number;
  };
  downloadOption?: {
    purchasable?: boolean;
    selected?: boolean;
    note?: string;
    unitPrice?: number;
  };
};

type ResultItem = {
  albumId: string;
  photoId: string;
  dl?: boolean;
  printl?: number;
  print2l?: number;
};

const buildSk = (albumId: string, photoId: string) =>
  `ALBUM#${albumId}#PHOTO#${photoId}`;

export function mergePurchasableOptions(
  a: CartItem[],
  b: CartEditT[]
): ResultItem[] {
  // A を sk -> item の Map に
  const aBySk = new Map<string, CartItem>(a.map((x) => [x.sk, x]));

  const results: ResultItem[] = [];

  for (const bItem of b) {
    const sk = buildSk(bItem.albumId, bItem.photoId);
    const aItem = aBySk.get(sk);
    if (!aItem) continue; // A 側が無いならスキップ（必要ならエラー扱いでもOK）

    const out: ResultItem = {albumId: bItem.albumId, photoId: bItem.photoId};
    let hasAny = false;

    // print の反映
    for (const p of bItem.print ?? []) {
      if (p.size === "printl") {
        if (aItem.printLOption?.purchasable === true) {
          out.printl = p.quantity;
          hasAny = true;
        }
      } else if (p.size === "print2l") {
        if (aItem.print2LOption?.purchasable === true) {
          out.print2l = p.quantity;
          hasAny = true;
        }
      }
    }

    // download の反映
    for (const d of bItem.download ?? []) {
      if (d.size === "dl") {
        if (aItem.downloadOption?.purchasable === true) {
          // 「dl」は selected が true の時だけ入れたいなら、ここで d.selected もチェック
          out.dl = d.selected;
          hasAny = true;
        }
      }
    }

    // 何も入らなかったら結果に入れない（要件に合わせて調整）
    if (hasAny) results.push(out);
  }

  return results;
}
