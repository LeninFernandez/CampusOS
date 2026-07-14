export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message);
  }
}

export class BadRequestError extends AppError {
  errors?: Record<string, string>;

  constructor(message = 'Bad request', errors?: Record<string, string>) {
    super(message);
    this.errors = errors;
  }
}
