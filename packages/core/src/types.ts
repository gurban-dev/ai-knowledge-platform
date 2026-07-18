/** Nominal typing helper to prevent mixing structurally-identical primitives. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type OrganizationId = Brand<string, 'OrganizationId'>;
export type UserId = Brand<string, 'UserId'>;

/** A value that may still be loading; distinguishes "absent" from "not yet known". */
export type Maybe<T> = T | null | undefined;

/** Recursively make all properties readonly. */
export type DeepReadonly<T> = T extends (infer R)[]
  ? readonly DeepReadonly<R>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** ISO-8601 timestamp string. */
export type ISODateString = Brand<string, 'ISODateString'>;

export function nowIso(): ISODateString {
  return new Date().toISOString() as ISODateString;
}
