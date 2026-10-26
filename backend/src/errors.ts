export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 422,
  ) {
    super(message);
  }
}
export function publicError(error: unknown): AppError {
  return error instanceof AppError
    ? error
    : new AppError(
        "INTERNAL_ERROR",
        "The request could not be completed. Please try again.",
        500,
      );
}
