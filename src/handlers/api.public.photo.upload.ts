import {Setting} from "../config";
import * as http from "../http";
import {
  PhotoUploadBody,
  PhotoUploadResponse,
  PhotoUploadResponseT,
} from "../schemas/photo";
import {parseOrThrow} from "../libs/validate";

import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

import {GetParameter} from "../utils/ParameterStore";
import * as Photo from "../utils/Dynamo/Photo";
import {config} from "process";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(PhotoUploadBody, raw);
  console.log("data", data);

  // 1. DynamoDB にレコードを作成
  let uploadId = "";
  let prefix = "";
  if (data.fileType === Setting.UPLOAD_FILE_TYPE.ZIP) {
    uploadId = await Photo.createZip(
      authContext.facilityCode,
      authContext.userId,
      data.shootingAt,
      data.valueType,
      data.tags
    );
    prefix = Setting.S3.PREFIX.PHOTO_ZIP_UPLOAD;
  } else {
    uploadId = await Photo.create(
      authContext.facilityCode,
      authContext.userId,
      data.shootingAt,
      data.valueType,
      data.tags
    );
    prefix = Setting.S3.PREFIX.PHOTO_UPLOAD;
  }

  // 2. 署名付きURLの発行 アップロードはPUTのみに絞るため、S3署名付きURLでのアップロードを行う
  const key = `${prefix}/${authContext.facilityCode}/${authContext.userId}/${uploadId}/${data.fileName}`;
  const s3Client = new S3Client({region: Setting.MAIN_REGION});
  const s3Command = new PutObjectCommand({
    Bucket: Setting.BUCKET_UPLOAD_NAME,
    Key: key,
  });
  const preSignedUrl = await getSignedUrl(s3Client, s3Command, {
    expiresIn: 60, // 即時アップされる想定なので、有効期限を短く1分とする
  });

  // 3. レスポンス作成
  const result: PhotoUploadResponseT = {
    url: preSignedUrl,
  };

  return http.ok(parseOrThrow(PhotoUploadResponse, result));
});
