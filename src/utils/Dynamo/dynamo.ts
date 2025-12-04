import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";
import {AppConfig} from "../../config";

let _doc: DynamoDBDocumentClient | null = null;

export function docClient(): DynamoDBDocumentClient {
  if (!_doc) {
    const client = new DynamoDBClient({region: AppConfig.MAIN_REGION});
    _doc = DynamoDBDocumentClient.from(client);
  }
  return _doc;
}
