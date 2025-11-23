import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
const s3Client = new S3Client({});

/**
 * Asynchronously deletes a file from an S3 bucket.
 *
 * @param {string} bucket - The name of the S3 bucket
 * @param {string} key - The key of the file to be deleted
 * @return {Promise<void>} A promise that resolves after the file is deleted
 */
export async function S3DirectoryDelete(bucket: string, path: string): Promise<void> {
  //Bucket内のオブジェクトリスト取得
  const objects = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: path,
    })
  );

  if (objects.Contents) {
    // オブジェクト一覧取得
    const keys = objects.Contents.map((d) => ({
      Key: d.Key as string,
    }));

    // オブジェクト一括削除
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys },
      })
    );
  }
}
