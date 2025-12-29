import {AppConfig, TagConfig} from "../config";
import * as http from "../http";
import {
  PhotoUploadBody,
  PhotoUploadResponse,
  PhotoUploadResponseT,
} from "../schemas/photo";
import {parseOrThrow} from "../libs/validate";

import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

import * as Photo from "../utils/Dynamo/Photo";
import * as Album from "../utils/Dynamo/Album";
import * as Tag from "../utils/Dynamo/Tag";
import {tagSplitter} from "../libs/tool";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(PhotoUploadBody, raw);
  console.log("data", data);

  // 1. アルバム指定がある場合はチェック
  const albums: string[] = [];
  if (data.albums.length > 0) {
    const albumList = await Album.list(authContext.facilityCode);
    // アルバムのステータスをチェックし、DRAFT以外の場合はエラー
    for (const album of data.albums) {
      const tmp = albumList.filter((a: any) => a.albumId === album);
      if (tmp.length === 0) {
        return http.badRequest({detail: "アルバムが存在しません"});
      }
      if (tmp[0].salesStatus !== "DRAFT") {
        return http.badRequest({detail: "対象のアルバムは選択できません"});
      }
      albums.push(album);
    }
  }
  console.log("albums", albums);

  // 2. タグ指定がある場合の処理
  const tags = tagSplitter(data.tags);
  console.log("tags", tags);

  // 登録可能タグ数の上限以上の場合はエラーを返す
  if (tags.length > TagConfig.TAG_LIMIT_PER_PHOTO) {
    return http.badRequest({
      detail: `タグは${TagConfig.TAG_LIMIT_PER_PHOTO}個までしか登録できません`,
    });
  }

  // タグが存在する場合はタグ履歴に登録
  if (tags.length > 0) {
    await Tag.historyAdd(authContext.facilityCode, authContext.userId, tags);
  }

  // 3. DynamoDB にレコードを作成
  let uploadId = "";
  let prefix = "";
  if (data.fileType === AppConfig.UPLOAD_FILE_TYPE.ZIP) {
    uploadId = await Photo.createZip(
      authContext.facilityCode,
      authContext.userId,
      data.shootingAt,
      data.priceTier,
      tags
    );
    prefix = AppConfig.S3.PREFIX.PHOTO_ZIP_UPLOAD;
  } else {
    uploadId = await Photo.create(
      authContext.facilityCode,
      authContext.userId,
      data.shootingAt,
      data.priceTier,
      tags,
      albums
    );
    prefix = AppConfig.S3.PREFIX.PHOTO_UPLOAD;
  }

  // 4. 署名付きURLの発行 アップロードはPUTのみに絞るため、S3署名付きURLでのアップロードを行う
  const key = `${prefix}/${authContext.facilityCode}/${authContext.userId}/${uploadId}/${data.fileName}`;
  const s3Client = new S3Client({region: AppConfig.MAIN_REGION});
  const s3Command = new PutObjectCommand({
    Bucket: AppConfig.BUCKET_UPLOAD_NAME,
    Key: key,
  });
  const preSignedUrl = await getSignedUrl(s3Client, s3Command, {
    expiresIn: 60, // 即時アップされる想定なので、有効期限を短く1分とする
  });

  // 5. レスポンス作成
  const result: PhotoUploadResponseT = {
    url: preSignedUrl,
  };

  return http.ok(parseOrThrow(PhotoUploadResponse, result));
});
