export const TABLE_NAME = process.env.TABLE_NAME_MAIN || "";

export const ZIP_EXPIRATION = 1209600; // ZIPを作成してからDynamoDBレコード削除するまでの期間：2週間
