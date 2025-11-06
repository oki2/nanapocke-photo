import * as v from "valibot";

export const Code = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9]{5}$/));
export const Name = v.pipe(v.string(), v.minLength(1));
export const ISODateTime = v.pipe(v.string(), v.isoTimestamp());
export const Status = v.picklist(["ACTIVE", "INACTIVE"]);

export const FacilityCreateBody = v.pipe(
  v.object({
    code: Code,
    name: Name,
    nbf: ISODateTime,
    exp: ISODateTime,
  }),
  v.custom((input) => {
    const d = input as {nbf?: string; exp?: string};
    if (!d.nbf || !d.exp) return true;
    return new Date(d.nbf).getTime() <= new Date(d.exp).getTime();
  }, "nbf must be <= exp")
);

export const FacilityCodePathParams = v.object({
  code: Code,
});

export const FacilityUpdateBody = v.pipe(
  v.object({
    name: v.optional(Name),
    nbf: v.optional(ISODateTime),
    exp: v.optional(ISODateTime),
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
  code: Code,
  name: Name,
  nbf: ISODateTime,
  exp: ISODateTime,
  status: Status,
  createdAt: ISODateTime,
  updatedAt: ISODateTime,
});

export const FacilityListResponse = v.array(
  v.object({
    code: Code,
    name: Name,
    nbf: ISODateTime,
    exp: ISODateTime,
    status: Status,
    createdAt: ISODateTime,
    updatedAt: ISODateTime,
  })
);

export type FacilityCreateBodyT = v.InferOutput<typeof FacilityCreateBody>;
export type FacilityResponseT = v.InferOutput<typeof FacilityResponse>;

export type FacilityListResponseT = v.InferOutput<typeof FacilityListResponse>;
