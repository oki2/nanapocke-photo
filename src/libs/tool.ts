/**
 * 文字列で取得したタグを、配列に分割する
 * @param {string} tagStr
 * @returns {string[]}
 */
export function tagSplitter(tagStr: string): string[] {
  return [...new Set(tagStr.trim().split(/[,#]+/).filter(Boolean))];
}

/**
 * 文字列で取得した PhotoId を、配列に分割する
 * @param {string} photoIdStr
 * @returns {string[]} PhotoId の配列
 */
export function photoIdSplitter(photoIdStr: string): string[] {
  return [
    ...new Set(
      photoIdStr
        .trim()
        .split(/[ ,#　]+/)
        .filter(Boolean)
    ),
  ];
}

/**
 * 文字列で取得した AlbumId を、配列に分割する
 * @param {string} albumIdStr
 * @returns {string[]} AlbumId の配列
 */
export function albumIdSplitter(albumIdStr: string): string[] {
  return [
    ...new Set(
      albumIdStr
        .trim()
        .split(/[ ,#　]+/)
        .filter(Boolean)
    ),
  ];
}

/**
 * 現在の日付から年度を取得する
 * @returns {number} 年度
 */
export function getAacademicYearJST(): number {
  const now = new Date(
    new Date().toLocaleString("ja-JP", {timeZone: "Asia/Tokyo"})
  );

  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return month >= 4 ? year : year - 1;
}
