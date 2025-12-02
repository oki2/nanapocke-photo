import * as v from "valibot";

// 保育園Code：ナナポケの仕様に合わせて5桁の文字
export const FacilityCode = v.pipe(v.string(), v.regex(/^[0-9]{5}$/));

// 保育園クラスCode：ナナポケの仕様に合わせて5桁の文字
export const ClassCode = v.pipe(v.string(), v.regex(/^[0-9]{7}$/));

// 保育園年齢Code：ナナポケの仕様に合わせて数値型
export const GradeCode = v.number();

// 保育園権限Code：ナナポケの仕様に合わせて数値型
export const RoleCode = v.number();

// 保育園ユーザーCode：ナナポケの仕様に合わせて8桁の文字
export const UserCode = v.pipe(v.string(), v.regex(/^[CE][0-9]{10}$/));
