import { Setting } from "./Setting";
export function CloudFrontVerifyTokenCheck(event: any = {}): boolean {
  const xOriginVerify = event.headers?.['x-origin-verify-token'] || '';
  if(xOriginVerify !== Setting.X_ORIGIN_VERIFY_TOKEN) {
    console.log(`xOriginVerify : ${xOriginVerify} / X_ORIGIN_VERIFY_TOKEN : ${Setting.X_ORIGIN_VERIFY_TOKEN}`);
    return false;
  }
  return true;
}