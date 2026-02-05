import axios from "redaxios";
import {GetParameter} from "../../ParameterStore";
import * as jwt from "jsonwebtoken";

const SSM_SMBC_SETTING_PATH = process.env.SSM_SMBC_SETTING_PATH || "";
const SMBC_API_GET_LINKPLUS = process.env.SMBC_API_GET_LINKPLUS || "";
const SMBC_API_SEARCH_TRADE_MULTI =
  process.env.SMBC_API_SEARCH_TRADE_MULTI || "";

export const CALLBACK_USER_ID = "SMBC:CALLBACK";

export const NOTIFICATION_RESPONSE = {
  RETURN_SUCCESS: 0,
  RETURN_ERROR: 1,
};

export const PAY_TYPE = {
  CREDIT: "0",
  PAYPAY: "45",
  CBSTORE: "3",
};

export const RESULT_CODE = {
  PAYSUCCESS: "PAYSUCCESS",
  REQSUCCESS: "REQSUCCESS",
  EXPIRED: "EXPIRED",
  INVALID: "INVALID",
  CREATE: "CREATE",
  SEND: "SEND",
  PAYSTART: "PAYSTART",
  CAPTURE: "CAPTURE",
  CONFIRM: "CONFIRM",
  REQPROCESS: "REQPROCESS",
  ERROR: "ERROR",
};

type SmbcSettingT = {
  configId: string;
  shopId: string;
  shopPass: string;
};
let _smbcSetting: SmbcSettingT | null = null;

export type SmbcNotificationT = {
  ShopID: string;
  OrderID: string;
  Status: string;
  PayType: string;
};

export async function getSmbcSetting(): Promise<any> {
  if (!_smbcSetting) {
    const tmp = await GetParameter(SSM_SMBC_SETTING_PATH);
    _smbcSetting = JSON.parse(tmp);
  }
  return _smbcSetting;
}

type CreateSmbcPaymentLinkParams = {
  orderId: string; // $orderId
  amount: number; // $orderAry['total']
  completeUrl: string; // $completeUrl
  cancelUrl: string; // $cancelUrl
};

type SmbcLinkPlusResponse = {
  LinkUrl?: string;
  // ほかのフィールドが返る可能性があるので必要に応じて追加
  [k: string]: unknown;
};

export class SmbcPaymentLinkError extends Error {
  public readonly status?: number;
  public readonly responseBody?: unknown;

  constructor(
    message: string,
    opts?: {status?: number; responseBody?: unknown},
  ) {
    super(message);
    this.name = "SmbcPaymentLinkError";
    this.status = opts?.status;
    this.responseBody = opts?.responseBody;
  }
}

/**
 * SMBC(LinkPlus) 決済リンク作成
 * - 200以外: 例外 throw
 * - 成功: LinkUrl を返す
 */
export async function createSmbcPaymentLink(
  params: CreateSmbcPaymentLinkParams,
): Promise<string> {
  const {orderId, amount, completeUrl, cancelUrl} = params;
  const {configId, shopId, shopPass} = await getSmbcSetting();

  // SMBC仕様に合わせ、日本時間で有効期限を作成する
  const expiredAtJst = createPaymentExpiredAtJST(600);

  const body = {
    configid: configId,
    transaction: {
      PaymentExpireDate: expiredAtJst,
      OrderID: orderId,
      Amount: amount,
      CompleteUrl: completeUrl,
      CancelUrl: cancelUrl,
    },
    geturlparam: {
      ShopID: shopId,
      ShopPass: shopPass,
    },
  };

  try {
    const res = await axios.post<SmbcLinkPlusResponse>(
      SMBC_API_GET_LINKPLUS,
      body,
      {
        headers: {"Content-Type": "application/json"},
        // redaxios は validateStatus が使えるので 200 だけ成功に寄せる
        validateStatus: (status) => status === 200,
      },
    );

    // validateStatus で 200 以外は catch に行くが、念のため
    if (res.status !== 200) {
      throw new SmbcPaymentLinkError("決済トークンの発行に失敗しました。", {
        status: res.status,
        responseBody: res.data,
      });
    }

    const linkUrl = res.data?.LinkUrl;
    if (!linkUrl || typeof linkUrl !== "string") {
      throw new SmbcPaymentLinkError(
        "SMBCのレスポンスに LinkUrl がありません。",
        {
          status: res.status,
          responseBody: res.data,
        },
      );
    }

    return linkUrl;
  } catch (err: any) {
    console.log("createSmbcPaymentLink body", body);
    console.error("createSmbcPaymentLink err", err);
    // redaxios は err.status / err.data が入ることがあるので吸い上げ
    const status = err?.status ?? err?.response?.status;
    const responseBody = err?.data ?? err?.response?.data;

    throw new SmbcPaymentLinkError("決済トークンの発行に失敗しました。", {
      status,
      responseBody,
    });
  }
}

function createPaymentExpiredAtJST(
  expiredSeconds: number,
  baseDate: Date = new Date(),
): string {
  // UTC + expiredSeconds
  const utcTime = baseDate.getTime() + expiredSeconds * 1000;

  // JST = UTC + 9時間
  const jstTime = utcTime + 9 * 60 * 60 * 1000;
  const jstDate = new Date(jstTime);

  const yyyy = jstDate.getUTCFullYear();
  const MM = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jstDate.getUTCDate()).padStart(2, "0");
  const HH = String(jstDate.getUTCHours()).padStart(2, "0");
  const mm = String(jstDate.getUTCMinutes()).padStart(2, "0");

  return `${yyyy}${MM}${dd}${HH}${mm}`;
}

export async function checkShopId(shopId: string): Promise<boolean> {
  const setting = await getSmbcSetting();
  if (shopId == setting.shopId) {
    return true;
  }
  return false;
}

type searchTradeMultiResponseT = {
  Status: string;
  ProcessDate: string;
  JobCd: string;
  AccessID: string;
  AccessPass: string;
  Amount: string;
  Tax: string;
  ClientField1: string;
  ClientField2: string;
  ClientField3: string;
  PayType: string;
  PayPayCancelAmount: string;
  PayPayCancelTax: string;
  PayPayTrackingID: string;
  PayPayAcceptCode: string;
  PayPayOrderID: string;
};
export async function searchTradeMulti(
  orderId: string,
  payType: string,
): Promise<searchTradeMultiResponseT | null> {
  const {shopId, shopPass} = await getSmbcSetting();
  const response = await axios.get(
    `${SMBC_API_SEARCH_TRADE_MULTI}?ShopID=${shopId}&ShopPass=${shopPass}&OrderID=${orderId}&PayType=${payType}`,
  );

  if (response.status !== 200) {
    return null;
  }
  console.log("response.data", response.data);

  const params = new URLSearchParams(response.data);
  const res = Object.fromEntries(params.entries()) as searchTradeMultiResponseT;
  console.log("res", res);

  // SMBC からのレスポンスにエラーがあった場合
  if (!res.Status) {
    console.log("smbc search error", res);
    return null;
  }

  const jst = res.ProcessDate;

  const year = Number(jst.slice(0, 4));
  const month = Number(jst.slice(4, 6)) - 1; // JSは0始まり
  const day = Number(jst.slice(6, 8));
  const hour = Number(jst.slice(8, 10));
  const minute = Number(jst.slice(10, 12));
  const second = Number(jst.slice(12, 14));

  // JST → UTC（-9時間）
  const utcDate = new Date(
    Date.UTC(year, month, day, hour - 9, minute, second),
  );
  res.ProcessDate = utcDate.toISOString().replace(".000", "");

  return res;
}
