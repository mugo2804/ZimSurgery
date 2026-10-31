export class HttpError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string[] | undefined>, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const notFound = (what = 'Record') => new HttpError(404, `${what} not found`);
export const forbidden = (msg = 'You do not have permission for this action') => new HttpError(403, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
export const badRequest = (msg: string) => new HttpError(400, msg);
