import {PaymentConfig} from "../config";
import * as http from "../http";
import {parseOrThrow} from "../libs/validate";
import {ShippingOption} from "../schemas/public";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  const res = {
    label: PaymentConfig.SHIPPING_LABEL,
    priceRule: {
      price: PaymentConfig.SHIPPING_POSTAGE_MAIL_FEE,
      maxSheetsPerShipment: PaymentConfig.POSTAGE_MAIL_LIMIT,
    },
  };

  return http.ok(parseOrThrow(ShippingOption, res));
});
