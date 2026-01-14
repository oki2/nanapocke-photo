import {mkdirSync, writeFileSync} from "node:fs";
import {toJsonSchema} from "@valibot/to-json-schema";
import * as SchemaPublic from "../src/schemas/public";
import * as CommonPublic from "../src/schemas/common";

const doc = {
  openapi: "3.1.0",
  info: {title: "Auth API", version: "1.0.0"},
  paths: {
    "/api/auth/signin": {
      post: {
        summary: "Sign（フォトグラファー専用）",
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
            description: "Signin success or challenge",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {$ref: "#/components/schemas/SigninSuccess"},
                    {$ref: "#/components/schemas/SigninChallenge"},
                  ],
                  discriminator: {
                    propertyName: "state",
                    mapping: {
                      success: "#/components/schemas/SigninSuccess",
                      challenge: "#/components/schemas/SigninChallenge",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/api/auth/refresh": {
      get: {
        summary: "アクセストークンのリフレッシュ",
        parameters: [
          {
            name: "refreshToken",
            in: "cookie",
            required: true,
            schema: toJsonSchema(CommonPublic.RefreshToken), // もしくは components 参照
          },
          {
            name: "userRole",
            in: "cookie",
            required: true,
            schema: toJsonSchema(CommonPublic.PublicRole), // もしくは components 参照
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
  },
  components: {
    schemas: {
      AuthSigninBody: toJsonSchema(SchemaPublic.AuthSigninBody),
      SigninSuccess: toJsonSchema(SchemaPublic.SigninSuccess),
      SigninChallenge: toJsonSchema(SchemaPublic.SigninChallenge),
      RefreshTokenCookie: toJsonSchema(SchemaPublic.RefreshTokenCookie),
      SigninResponse: toJsonSchema(SchemaPublic.SigninResponse),
    },
  },
} as const;

mkdirSync("work/openapi/dist", {recursive: true});
writeFileSync(
  "work/openapi/dist/openapi.public.json",
  JSON.stringify(doc, null, 2)
);
