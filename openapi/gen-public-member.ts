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
    {name: "Album", description: "アルバム管理"},
    {name: "Photo", description: "写真管理"},
    {name: "Cart", description: "カート管理"},
    {name: "Payment", description: "決済管理"},
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
    },

    "/api/facility/{facilityCode}/album/list": {
      get: {
        tags: ["Album"],
        summary: "アルバム一覧取得",
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
            description: "アルバム一覧返却",
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

    "/api/facility/{facilityCode}/album/{albumId}/photo/list": {
      get: {
        tags: ["Photo"],
        summary: "写真一覧",
        parameters: [
          {
            name: "facilityCode",
            in: "path",
            required: true,
            schema: toJsonSchemaSafe(SchemaPublic.AlbumPathParameters), // もしくは components 参照
          },
        ],
        responses: {
          "200": {
            description: "写真一覧取得成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AlbumPhotoListResponse",
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

    "/api/my/cart": {
      post: {
        tags: ["Cart"],
        summary: "カートに写真追加",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {$ref: "#/components/schemas/CartAddBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "カートに写真追加成功",
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
      put: {
        tags: ["Cart"],
        summary: "カート内写真枚数変更",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {$ref: "#/components/schemas/CartEditBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "カート内写真枚数変更成功",
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

    "/api/my/cart/list": {
      get: {
        tags: ["Cart"],
        summary: "カート内情報取得",
        responses: {
          "200": {
            description: "カート内情報取得成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CartItemList",
                },
              },
            },
          },
        },
      },
    },

    "/api/my/cart/item/{albumId}/{photoId}": {
      delete: {
        tags: ["Cart"],
        summary: "カート内写真削除",
        parameters: [
          {
            name: "facilityCode",
            in: "path",
            required: true,
            schema: toJsonSchemaSafe(
              SchemaPublic.CartPhotoDeletePathParameters,
            ), // もしくは components 参照
          },
        ],
        responses: {
          "200": {
            description: "カート内写真削除成功",
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

    "/api/my/cart/checkout": {
      post: {
        tags: ["Cart"],
        summary: "カート内写真からチェックアウト情報を作成",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {$ref: "#/components/schemas/CheckoutBody"},
            },
          },
        },
        responses: {
          "200": {
            description: "カート内写真からチェックアウト情報を作成成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/OrderCheckout",
                },
              },
            },
          },
        },
      },
    },

    "/api/my/payment/list": {
      get: {
        tags: ["Payment"],
        summary: "決済履歴一覧を取得",
        responses: {
          "200": {
            description: "決済履歴一覧取得成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PaymentHistoryList",
                },
              },
            },
          },
        },
      },
    },

    "/api/my/payment/{OrderID}": {
      get: {
        tags: ["Payment"],
        summary: "決済履歴詳細を取得",
        responses: {
          "200": {
            description: "決済履歴詳細取得成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/OrderDetail",
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
      AlbumListResponse: toJsonSchemaSafe(SchemaPublic.AlbumListResponse),
      AlbumPathParameters: toJsonSchemaSafe(SchemaPublic.AlbumPathParameters),
      AlbumPhotoListResponse: toJsonSchemaSafe(
        SchemaPublic.AlbumPhotoListResponse,
      ),
      MetaListResponse: toJsonSchemaSafe(SchemaPublic.MetaListResponse),
      CartAddBody: toJsonSchemaSafe(SchemaPublic.CartAddBody),
      CartItemList: toJsonSchemaSafe(SchemaPublic.CartItemList),
      CartEditBody: toJsonSchemaSafe(SchemaPublic.CartEditBody),
      CheckoutBody: toJsonSchemaSafe(SchemaPublic.CheckoutBody),
      OrderCheckout: toJsonSchemaSafe(SchemaPublic.OrderCheckout),
      PaymentHistoryList: toJsonSchemaSafe(SchemaPublic.PaymentHistoryList),
    },
  },
} as const;

mkdirSync("work/openapi/dist", {recursive: true});
writeFileSync(
  "work/openapi/dist/openapi.public.member.json",
  JSON.stringify(doc, null, 2),
);
