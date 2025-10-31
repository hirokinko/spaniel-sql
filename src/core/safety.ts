export class QueryBuildError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'QueryBuildError';
  }
}

let STRICT = true;
export function setStrictMode(flag: boolean) {
  STRICT = !!flag;
}
export function isStrict() {
  return STRICT;
}
