export class HttpError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string[]>;

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.errors = errors;
  }

  get body(): Record<string, unknown> {
    return this.errors ? { message: this.message, errors: this.errors } : { message: this.message };
  }
}

export const unauthorized = (message = 'Unauthenticated.') => new HttpError(401, message);
export const notFound = (message = 'Resource not found.') => new HttpError(404, message);
export const unprocessable = (message: string, errors?: Record<string, string[]>) =>
  new HttpError(422, message, errors);
