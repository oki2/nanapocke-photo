import * as http from "../http";

import {AppConfig} from "../config";
import {
  AlbumCreateBody,
  AlbumCreateResponse,
  AlbumCreateResponseT,
} from "../schemas/album";
import {parseOrThrow} from "../libs/validate";

import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

import * as Album from "../utils/Dynamo/Album";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(AlbumCreateBody, raw);
  console.log("data", data);

  // 2. DynamoDB に Album を作成
  const album = await Album.create(
    authContext.facilityCode,
    authContext.userId,
    data.title,
    data.description ?? "",
    data.priceTable,
    data.salesPeriod
  );

  const result: AlbumCreateResponseT = {
    albumId: album.albumId,
    title: album.title,
  };

  // 3. アルバム画像が存在する場合は、署名付きURLの発行 アップロードはPUTのみに絞るため、S3署名付きURLでのアップロードを行う
  if (data.coverImage) {
    const key = `${AppConfig.S3.PREFIX.ALBUM_IMAGE_UPLOAD}/${authContext.facilityCode}/${album.albumId}/${authContext.userId}/${data.coverImage}`;
    const s3Client = new S3Client({region: AppConfig.MAIN_REGION});
    const s3Command = new PutObjectCommand({
      Bucket: AppConfig.BUCKET_UPLOAD_NAME,
      Key: key,
    });
    result.url = await getSignedUrl(s3Client, s3Command, {
      expiresIn: 60, // 即時アップされる想定なので、有効期限を短く1分とする
    });
  }

  return http.ok(parseOrThrow(AlbumCreateResponse, result));
});
