import {writeFileSync} from "node:fs";
import {toJsonSchema} from "@valibot/to-json-schema";
import {
  AuthSigninBody,
  SigninSuccess,
  SigninChallenge,
} from "../src/schemas/api.admin.auth";

const doc = {
  openapi: "3.1.0",
  info: {title: "Auth API", version: "1.0.0"},
  paths: {
    "/api/admin/auth/signin": {
      post: {
        summary: "Sign in",
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
  },
  components: {
    schemas: {
      AuthSigninBody: toJsonSchema(AuthSigninBody),
      SigninSuccess: toJsonSchema(SigninSuccess),
      SigninChallenge: toJsonSchema(SigninChallenge),
    },
  },
} as const;

writeFileSync("openapi/dist/openapi.admin.json", JSON.stringify(doc, null, 2));
