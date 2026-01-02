import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";
import {created} from "../http";
import {AlbumConfig} from "../config";

const PaymentHistory = v.object({
  orderId: common.OrderId,
  countPrint: v.number(),
  countDl: v.number(),
  processDate: common.ISODateTime,
  grandTotal: v.number(),
});

export const PaymentHistoryList = v.array(PaymentHistory);
export type PaymentHistoryListT = v.InferOutput<typeof PaymentHistoryList>;

export const PaymentPathParameters = v.object({
  orderId: common.OrderId,
});
