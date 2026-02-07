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

    "/api/facility/{facilityCode}/photographer": {
      post: {
        tags: ["Photographer"],
        summary: "フォトグラファー 登録",
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
              schema: {$ref: "#/components/schemas/PhotographerCreateBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "フォトグラファー登録成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PhotographerCreateResponse",
                },
              },
            },
          },
        },
      },
    },

    "/api/facility/{facilityCode}/photographer/list": {
      get: {
        tags: ["Photographer"],
        summary: "フォトグラファー 一覧",
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
            description: "フォトグラファー 一覧取得成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PhotographerList",
                },
              },
            },
          },
        },
      },
    },

    "/api/facility/{facilityCode}/photographer/{photographerId}": {
      patch: {
        tags: ["Photographer"],
        summary: "フォトグラファー 編集",
        parameters: [
          {
            name: "facilityCode",
            in: "path",
            required: true,
            schema: toJsonSchemaSafe(SchemaPublic.PhotographerPathParameters), // もしくは components 参照
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {$ref: "#/components/schemas/PhotographerEditBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "フォトグラファー編集成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ResultOK",
                },
              },
            },
          },
        },
      },
    },

    "/api/facility/{facilityCode}/album": {
      post: {
        tags: ["Album"],
        summary: "アルバム作成",
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
              schema: {$ref: "#/components/schemas/AlbumCreateBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "アルバム作成成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AlbumCreateResponse",
                },
              },
            },
          },
        },
      },
    },

    "/api/facility/{facilityCode}/album/list": {
      get: {
        tags: ["Album"],
        summary: "アルバム一覧",
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
            description: "アルバム作成成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AlbumListResponse",
                },
              },
            },
          },
        },
      },
    },

    "/api/facility/{facilityCode}/album/{albumId}": {
      patch: {
        tags: ["Album"],
        summary: "アルバム編集",
        parameters: [
          {
            name: "facilityCode",
            in: "path",
            required: true,
            schema: toJsonSchemaSafe(SchemaPublic.AlbumPathParameters), // もしくは components 参照
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {$ref: "#/components/schemas/AlbumEditBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "アルバム作成成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AlbumEditResponse",
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Album"],
        summary: "アルバム削除",
        parameters: [
          {
            name: "facilityCode",
            in: "path",
            required: true,
            schema: toJsonSchemaSafe(SchemaPublic.AlbumPathParameters), // もしくは components 参照
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {$ref: "#/components/schemas/AlbumEditBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "アルバ削除除成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ResultOK",
                },
              },
            },
          },
        },
      },
    },

    "/api/facility/{facilityCode}/album/{albumId}/sales": {
      patch: {
        tags: ["Album"],
        summary: "アルバム編集",
        parameters: [
          {
            name: "facilityCode",
            in: "path",
            required: true,
            schema: toJsonSchemaSafe(SchemaPublic.AlbumPathParameters), // もしくは components 参照
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {$ref: "#/components/schemas/AlbumSalesBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "アルバム作成成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ResultOK",
                },
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

    "/api/facility/{facilityCode}/photo/list": {
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
          {
            name: "albumId",
            in: "query",
            required: false,
            schema: toJsonSchemaSafe(SchemaPublic.PhotoSelect), // もしくは components 参照
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

    "/api/facility/{facilityCode}/photo/join/album": {
      put: {
        tags: ["Photo"],
        summary: "写真のアルバム一括紐付け",
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
              schema: {$ref: "#/components/schemas/PhotoJoinAlbumBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "写真のアルバム一括紐付け成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ResultOK",
                },
              },
            },
          },
        },
      },
    },

    "/api/facility/{facilityCode}/photo/{photoId}/download": {
      get: {
        tags: ["Photo"],
        summary: "写真のダウンロード",
        parameters: [
          {
            name: "facilityCode",
            in: "path",
            required: true,
            schema: toJsonSchemaSafe(SchemaPublic.PhotoPathParameters), // もしくは components 参照
          },
        ],
        responses: {
          "200": {
            description: "写真のダウンロード成功",
            content: {
              "image/jpeg": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
        },
      },
    },

    "/api/facility/{facilityCode}/photo/{photoId}": {
      get: {
        tags: ["Photo"],
        summary: "写真の削除",
        parameters: [
          {
            name: "facilityCode",
            in: "path",
            required: true,
            schema: toJsonSchemaSafe(SchemaPublic.PhotoPathParameters), // もしくは components 参照
          },
        ],
        responses: {
          "200": {
            description: "写真の削除成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ResultOK",
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
      SigninChallenge: toJsonSchemaSafe(SchemaPublic.SigninChallenge),
      RefreshTokenCookie: toJsonSchemaSafe(SchemaPublic.RefreshTokenCookie),
      SigninResponse: toJsonSchemaSafe(SchemaPublic.SigninResponse),
      PhotographerCreateBody: toJsonSchemaSafe(
        SchemaPublic.PhotographerCreateBody,
      ),
      PhotographerCreateResponse: toJsonSchemaSafe(
        SchemaPublic.PhotographerCreateResponse,
      ),
      PhotographerList: toJsonSchemaSafe(SchemaPublic.PhotographerList),
      PhotographerEditBody: toJsonSchemaSafe(SchemaPublic.PhotographerEditBody),
      AlbumCreateBody: toJsonSchemaSafe(SchemaPublic.AlbumCreateBody),
      AlbumCreateResponse: toJsonSchemaSafe(SchemaPublic.AlbumCreateResponse),
      AlbumListResponse: toJsonSchemaSafe(SchemaPublic.AlbumListResponse),
      AlbumEditBody: toJsonSchemaSafe(SchemaPublic.AlbumEditBody),
      AlbumEditResponse: toJsonSchemaSafe(SchemaPublic.AlbumEditResponse),
      AlbumSalesBody: toJsonSchemaSafe(SchemaPublic.AlbumSalesBody),
      PhotoUploadBody: toJsonSchemaSafe(SchemaPublic.PhotoUploadBody),
      PhotoUploadResponse: toJsonSchemaSafe(SchemaPublic.PhotoUploadResponse),
      PhotoListResponse: toJsonSchemaSafe(SchemaPublic.PhotoListResponse),
      PhotoJoinAlbumBody: toJsonSchemaSafe(SchemaPublic.PhotoJoinAlbumBody),
      MetaListResponse: toJsonSchemaSafe(SchemaPublic.MetaListResponse),
    },
  },
} as const;

mkdirSync("work/openapi/dist", {recursive: true});
writeFileSync(
  "work/openapi/dist/openapi.public.admin.json",
  JSON.stringify(doc, null, 2),
);
