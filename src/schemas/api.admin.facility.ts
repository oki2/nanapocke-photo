import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";

// export const Code = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9]{5}$/));
export const Name = v.pipe(v.string(), v.minLength(1));
export const Status = v.picklist(["ACTIVE", "INACTIVE"]);

const FacilityClass = v.object({
  code: nanapocke.ClassCode,
  name: Name,
  grade: v.pipe(v.string(), v.regex(/^[0-9]{1}$/)),
});

export const FacilityCreateBody = v.pipe(
  v.object({
    code: nanapocke.FacilityCode,
    name: Name,
    nbf: common.ISODateTime,
    exp: common.ISODateTime,
    classList: v.array(FacilityClass),
  }),
  v.custom((input) => {
    const d = input as {nbf?: string; exp?: string};
    if (!d.nbf || !d.exp) return true;
    return new Date(d.nbf).getTime() <= new Date(d.exp).getTime();
  }, "nbf must be <= exp")
);

export const FacilityCodePathParams = v.object({
  code: nanapocke.FacilityCode,
});

export const FacilityUpdateBody = v.pipe(
  v.object({
    name: v.optional(Name),
    nbf: v.optional(common.ISODateTime),
    exp: v.optional(common.ISODateTime),
    status: v.optional(Status),
  }),
  v.custom((input) => {
    const d = input as {nbf?: string; exp?: string};
    if (!d.nbf || !d.exp) return true;
    return new Date(d.nbf).getTime() <= new Date(d.exp).getTime();
  }, "nbf must be <= exp"),
  v.custom((input) => {
    const d = input as {
      name?: string;
      nbf?: string;
      exp?: string;
      status?: string;
    };
    return !!(d.name || d.nbf || d.exp || d.status);
  }, "At least one of name, nbf, exp or status is required")
);

export const FacilityResponse = v.object({
  code: nanapocke.FacilityCode,
  name: Name,
  nbf: common.ISODateTime,
  exp: common.ISODateTime,
  classCount: v.number(),
});

export const FacilityListResponse = v.array(
  v.object({
    code: nanapocke.FacilityCode,
    name: Name,
    nbf: common.ISODateTime,
    exp: common.ISODateTime,
    status: Status,
    createdAt: common.ISODateTime,
    updatedAt: common.ISODateTime,
  })
);

export type FacilityCreateBodyT = v.InferOutput<typeof FacilityCreateBody>;
export type FacilityResponseT = v.InferOutput<typeof FacilityResponse>;

export type FacilityListResponseT = v.InferOutput<typeof FacilityListResponse>;
