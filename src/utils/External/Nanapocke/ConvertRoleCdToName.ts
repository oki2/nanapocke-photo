export function ConvertRoleCdToName(roleCd: number): string {
  switch (roleCd) {
    case 2:
    case 3:
    case 8:
      return "Principal"; // 園長
    case 4:
    case 5:
    case 6:
    case 9:
      return "Teacher"; // 保育士
    case 0:
      return "Guardian"; // 保護者
    case 1:
    case 7:
    default:
      return "unknown"; // 不明・利用不可
  }
}
