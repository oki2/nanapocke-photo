import {CartConfig, PhotoConfig} from "../../../config";
import * as CartModel from "./Model";

import {
  OrderItemBaseT,
  OrderPrintLineT,
  OrderDownloadLineT,
} from "../../../schemas/public";

export type PriceTier =
  (typeof PhotoConfig.PRICE_TIER)[keyof typeof PhotoConfig.PRICE_TIER];
const ALL_PRICE_TIERS = Object.values(PhotoConfig.PRICE_TIER) as PriceTier[];

type Summary = {
  downloadSelectedCount: number;
  downloadTotalPrice: number;
  printLQuantityTotal: number;
  printLTotalPrice: number;
  print2LQuantityTotal: number;
  print2LTotalPrice: number;
};

type SummaryByTier = Record<PriceTier, Summary>;

type Item = {
  priceTier: PriceTier; // ← ここは必須でOK
  downloadOption?: {selected?: boolean; unitPrice?: number};
  printLOption?: {purchasable?: boolean; quantity?: number; unitPrice?: number};
  print2LOption?: {
    purchasable?: boolean;
    quantity?: number;
    unitPrice?: number;
  };
};

const emptySummary = (): Summary => ({
  downloadSelectedCount: 0,
  downloadTotalPrice: 0,
  printLQuantityTotal: 0,
  printLTotalPrice: 0,
  print2LQuantityTotal: 0,
  print2LTotalPrice: 0,
});

export function summarizeItemsByPriceTier(items: Item[]): SummaryByTier {
  // PRICE_TIER から全 Tier を初期化
  const acc = Object.fromEntries(
    ALL_PRICE_TIERS.map((tier) => [tier, emptySummary()]),
  ) as SummaryByTier;

  for (const item of items) {
    const summary = acc[item.priceTier];

    // download
    if (item.downloadOption?.selected === true) {
      summary.downloadSelectedCount += 1;
      summary.downloadTotalPrice += item.downloadOption.unitPrice ?? 0;
    }

    // print L
    if (item.printLOption?.purchasable === true) {
      const qty = item.printLOption.quantity ?? 0;
      const price = item.printLOption.unitPrice ?? 0;
      summary.printLQuantityTotal += qty;
      summary.printLTotalPrice += qty * price;
    }

    // print 2L
    if (item.print2LOption?.purchasable === true) {
      const qty = item.print2LOption.quantity ?? 0;
      const price = item.print2LOption.unitPrice ?? 0;
      summary.print2LQuantityTotal += qty;
      summary.print2LTotalPrice += qty * price;
    }
  }

  return acc;
}

export function sumAllTiers(summaryByTier: SummaryByTier): Summary {
  return Object.values(summaryByTier).reduce<Summary>(
    (acc, cur) => {
      acc.downloadSelectedCount += cur.downloadSelectedCount;
      acc.downloadTotalPrice += cur.downloadTotalPrice;
      acc.printLQuantityTotal += cur.printLQuantityTotal;
      acc.printLTotalPrice += cur.printLTotalPrice;
      acc.print2LQuantityTotal += cur.print2LQuantityTotal;
      acc.print2LTotalPrice += cur.print2LTotalPrice;
      return acc;
    },
    {
      downloadSelectedCount: 0,
      downloadTotalPrice: 0,
      printLQuantityTotal: 0,
      printLTotalPrice: 0,
      print2LQuantityTotal: 0,
      print2LTotalPrice: 0,
    },
  );
}

// CHECKOUT レスポンス用 ===============================================
type SalesSize =
  (typeof PhotoConfig.SALES_SIZE)[keyof typeof PhotoConfig.SALES_SIZE];

type SourceItem = {
  facilityCode: string;
  albumId: string;
  albumSequenceId: number;
  albumTitle: string;
  photoId: string;
  photoSequenceId: number;
  priceTier: string; // common.PhotoPriceTier に合う前提
  shootingBy: string;
  downloadOption?: {
    purchasable?: boolean;
    selected?: boolean;
    size?: SalesSize; // "dl"
    note?: string;
    unitPrice?: number;
  };
  printLOption?: {
    purchasable?: boolean;
    quantity?: number;
    size?: SalesSize; // "printl"
    unitPrice?: number;
  };
  print2LOption?: {
    purchasable?: boolean;
    quantity?: number;
    size?: SalesSize; // "print2l"
    unitPrice?: number;
  };
};

type ResolveImageUrl = (src: SourceItem) => string;
type ResolveDownloadUrl = (src: SourceItem) => string | undefined;

export function toOrderItems(
  sources: SourceItem[],
  deps: {
    resolveImageUrl: ResolveImageUrl;
    resolveDownloadUrl?: ResolveDownloadUrl; // 履歴のみ必要なら渡す
  },
): OrderItemBaseT[] {
  return sources.map((src) => {
    // ---- print lines ----
    const print: OrderPrintLineT[] = [];

    // printL
    if (src.printLOption?.purchasable === true) {
      const qty = src.printLOption.quantity ?? 0;
      const unit = src.printLOption.unitPrice ?? 0;

      if (qty > 0) {
        print.push({
          size: PhotoConfig.SALES_SIZE.PRINT_L,
          quantity: qty,
          subTotal: qty * unit,
        });
      }
    }

    // print2L
    if (src.print2LOption?.purchasable === true) {
      const qty = src.print2LOption.quantity ?? 0;
      const unit = src.print2LOption.unitPrice ?? 0;

      if (qty > 0) {
        print.push({
          size: PhotoConfig.SALES_SIZE.PRINT_2L,
          quantity: qty,
          subTotal: qty * unit,
        });
      }
    }

    // ---- download lines ----
    const download: OrderDownloadLineT[] = [];

    if (
      src.downloadOption?.purchasable === true &&
      src.downloadOption.selected === true
    ) {
      const unit = src.downloadOption.unitPrice ?? 0;

      download.push({
        size: PhotoConfig.SALES_SIZE.DL_ORIGINAL,
        note: src.downloadOption.note ?? "",
        subTotal: unit, // DL は数量概念が無い想定（1件=unitPrice）
        downloadUrl: deps.resolveDownloadUrl?.(src),
      });
    }

    const itemTotal =
      print.reduce((sum, p) => sum + p.subTotal, 0) +
      download.reduce((sum, d) => sum + d.subTotal, 0);

    return {
      albumId: src.albumId,
      albumSequenceId: src.albumSequenceId,
      albumTitle: src.albumTitle,
      photoId: src.photoId,
      photoSequenceId: src.photoSequenceId,
      imageUrl: deps.resolveImageUrl(src),
      priceTier: src.priceTier,
      print,
      download,
      itemTotal,
    };
  });
}
