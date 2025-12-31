import axios from "redaxios";

type CreateSmbcPaymentLinkParams = {
  paymentUrl: string; // PAYMENT_LINKPLUS_PAY_URL
  configId: string; // PAYMENT_CONFIG_ID
  shopId: string; // PAYMENT_SHOP_ID
  shopPass: string; // PAYMENT_SHOP_PASS
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
    opts?: {status?: number; responseBody?: unknown}
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
  params: CreateSmbcPaymentLinkParams
): Promise<string> {
  const {
    paymentUrl,
    configId,
    shopId,
    shopPass,
    orderId,
    amount,
    completeUrl,
    cancelUrl,
  } = params;

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
    const res = await axios.post<SmbcLinkPlusResponse>(paymentUrl, body, {
      headers: {"Content-Type": "application/json"},
      // redaxios は validateStatus が使えるので、PHP同様 200 だけ成功に寄せる
      validateStatus: (status) => status === 200,
    });

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
        }
      );
    }

    return linkUrl;
  } catch (err: any) {
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
  baseDate: Date = new Date()
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
