import * as v from "valibot";

export const Code = v.pipe(v.string(), v.minLength(1));

export const CodeQueryParams = v.object({
  code: Code,
});

export type CodeQueryParamsT = v.InferOutput<typeof CodeQueryParams>;
