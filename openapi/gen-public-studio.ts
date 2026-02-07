import {mkdirSync, writeFileSync} from "node:fs";
import {toJsonSchema} from "@valibot/to-json-schema";
import * as SchemaPublic from "../src/schemas/public";
import * as SchemasPublic from "../src/schemas/common";

const toJsonSchemaSafe = (schema: any) =>
  toJsonSchema(schema, {
    // 変換できない schema/action があっても落とさず進める
    errorMode: "ignore",
    // check を明示的に無視（= 今回のエラー要因）
    ignoreActions: ["check"],
  });

const doc = {
  openapi: "3.1.0",
  info: {title: "Auth API", version: "1.0.0"},
  tags: [
    {name: "Auth", description: "認証"},
    {name: "Photographer", description: "フォトグラファー管理"},
    {name: "Album", description: "アルバム管理"},
    {name: "Photo", description: "写真管理"},
    {name: "Other", description: "その他"},
  ],
  paths: {
    "/api/auth/signin": {
      post: {
        tags: ["Auth"],
        summary: "フォトグラファーログイン",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {$ref: "#/components/schemas/AuthSigninBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "フォトグラファーログイン成功",
            content: {
              "application/json": {
                schema: {$ref: "#/components/schemas/SigninSuccess"},
              },
            },
          },
        },
      },
    },

    "/api/auth/refresh": {
      get: {
        tags: ["Auth"],
        summary: "アクセストークンのリフレッシュ",
        parameters: [
          {
            name: "refreshToken",
            in: "cookie",
            required: true,
            schema: toJsonSchemaSafe(SchemasPublic.RefreshToken), // もしくは components 参照
          },
          {
            name: "userRole",
            in: "cookie",
            required: true,
            schema: toJsonSchemaSafe(SchemasPublic.PublicRole), // もしくは components 参照
          },
        ],
        responses: {
          "200": {
            description: "Refresh success",
            content: {
              "application/json": {
                schema: {$ref: "#/components/schemas/SigninResponse"},
              },
            },
          },
        },
      },
      delete: {
        tags: ["Auth"],
        summary: "リフレッシュトークンの無効化・ログアウト",
        parameters: [
          {
            name: "refreshToken",
            in: "cookie",
            required: true,
            schema: toJsonSchemaSafe(SchemasPublic.RefreshToken), // もしくは components 参照
          },
          {
            name: "userRole",
            in: "cookie",
            required: true,
            schema: toJsonSchemaSafe(SchemasPublic.PublicRole), // もしくは components 参照
          },
        ],
        responses: {
          "200": {
            description: "Refresh Revoke success",
            content: {
              "application/json": {
                schema: {$ref: "#/components/schemas/ResultOK"},
              },
            },
          },
        },
      },
    },

    "/api/facility/{facilityCode}/photo": {
      post: {
        tags: ["Photo"],
        summary: "写真 / zip アップロード",
        parameters: [
          {
            name: "facilityCode",
            in: "path",
            required: true,
            schema: toJsonSchemaSafe(SchemaPublic.FacilityCodePathParameters), // もしくは components 参照
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {$ref: "#/components/schemas/PhotoUploadBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "ファイルアップロード用URL返却",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PhotoUploadResponse",
                },
              },
            },
          },
        },
      },
    },

    "/api/facility/{facilityCode}/photo/list/my": {
      get: {
        tags: ["Photo"],
        summary: "写真一覧",
        parameters: [
          {
            name: "facilityCode",
            in: "path",
            required: true,
            schema: toJsonSchemaSafe(SchemaPublic.FacilityCodePathParameters), // もしくは components 参照
          },
        ],
        responses: {
          "200": {
            description: "写真一覧取得成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PhotoListResponse",
                },
              },
            },
          },
        },
      },
    },

    "/api/facility/{facilityCode}/meta/list": {
      get: {
        tags: ["Other"],
        summary: "メタ情報取得",
        parameters: [
          {
            name: "facilityCode",
            in: "path",
            required: true,
            schema: toJsonSchemaSafe(SchemaPublic.FacilityCodePathParameters), // もしくは components 参照
          },
        ],
        responses: {
          "200": {
            description: "メタ情報取得成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MetaListResponse",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ResultOK: toJsonSchemaSafe(SchemaPublic.ResultOK),
      AuthSigninBody: toJsonSchemaSafe(SchemaPublic.AuthSigninBody),
      SigninSuccess: toJsonSchemaSafe(SchemaPublic.SigninSuccess),
      RefreshTokenCookie: toJsonSchemaSafe(SchemaPublic.RefreshTokenCookie),
      SigninResponse: toJsonSchemaSafe(SchemaPublic.SigninResponse),
      PhotoUploadBody: toJsonSchemaSafe(SchemaPublic.PhotoUploadBody),
      PhotoUploadResponse: toJsonSchemaSafe(SchemaPublic.PhotoUploadResponse),
      PhotoListResponse: toJsonSchemaSafe(SchemaPublic.PhotoListResponse),
      MetaListResponse: toJsonSchemaSafe(SchemaPublic.MetaListResponse),
    },
  },
} as const;

mkdirSync("work/openapi/dist", {recursive: true});
writeFileSync(
  "work/openapi/dist/openapi.public.studio.json",
  JSON.stringify(doc, null, 2),
);
