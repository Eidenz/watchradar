export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    if (extra) Object.assign(this, extra);
  }
}
export const err = (status, message, extra) => new HttpError(status, message, extra);

/** Wrap an async handler so rejections reach the error middleware. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function int(v, name, { min, max, optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return undefined;
    throw err(400, `${name} is required`);
  }
  const n = Number(v);
  if (!Number.isInteger(n)) throw err(400, `${name} must be an integer`);
  if (min !== undefined && n < min) throw err(400, `${name} must be >= ${min}`);
  if (max !== undefined && n > max) throw err(400, `${name} must be <= ${max}`);
  return n;
}

export function str(v, name, { max = 2000, optional = false, trim = true } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return undefined;
    throw err(400, `${name} is required`);
  }
  if (typeof v !== 'string') throw err(400, `${name} must be a string`);
  const s = trim ? v.trim() : v;
  if (!s && !optional) throw err(400, `${name} is required`);
  if (s.length > max) throw err(400, `${name} is too long (max ${max})`);
  return s;
}

export function oneOf(v, allowed, name) {
  if (!allowed.includes(v)) throw err(400, `${name} must be one of: ${allowed.join(', ')}`);
  return v;
}

export function page(q, size = 24) {
  const p = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || size));
  return { page: p, limit, offset: (p - 1) * limit };
}

export const paginate = (total, { page, limit }) => ({
  page,
  limit,
  total,
  pages: Math.max(1, Math.ceil(total / limit)),
});
