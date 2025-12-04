import {AppConfig} from "../../../config";

export function ConvertRoleCdToName(roleCd: number): string {
  switch (roleCd) {
    case 2:
    case 3:
    case 8:
      return AppConfig.ROLE.PRINCIPAL; // 園長
    case 4:
    case 5:
    case 6:
    case 9:
      return AppConfig.ROLE.TEACHER; // 保育士
    case 0:
      return AppConfig.ROLE.GUARDIAN; // 保護者
    case 1:
    case 7:
    default:
      return "UNKNOWN"; // 不明・利用不可
  }
}
