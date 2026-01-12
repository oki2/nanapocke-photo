import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
} from "@aws-sdk/client-sqs";
import {AppConfig} from "../../config";

import {chunk} from "../../libs/tool";

const sqsClient = new SQSClient({region: AppConfig.MAIN_REGION});

/**
 * Asynchronously deletes a file from an S3 bucket.
 *
 * @param {string} bucket - The name of the S3 bucket
 * @param {string} key - The key of the file to be deleted
 * @return {Promise<void>} A promise that resolves after the file is deleted
 */
export async function SqsSendMessage(
  queUrl: string,
  messageAttributes: any,
  messageBody: string,
  delaySeconds: number = 0
): Promise<void> {
  try {
    const response = await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queUrl,
        DelaySeconds: delaySeconds,
        MessageAttributes: messageAttributes,
        MessageBody: messageBody,
      })
    );
    return;
  } catch (e: any) {
    throw e;
  }
}

export async function SqsSendMessageList(
  queUrl: string,
  messageBodyList: string[],
  delaySeconds: number = 0
): Promise<void> {
  const messageChunk = chunk(messageBodyList, 10);

  for (const messageBody of messageChunk) {
    await sqsClient.send(
      new SendMessageBatchCommand({
        QueueUrl: queUrl,
        Entries: messageBody.map((d, i) => ({
          Id: `${i}`,
          DelaySeconds: delaySeconds,
          MessageBody: d,
        })),
      })
    );
  }
}
