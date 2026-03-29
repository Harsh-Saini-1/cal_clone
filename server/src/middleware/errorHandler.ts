import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
}

/**
 * Central error handling middleware.
 * All unhandled errors bubble up here.
 * Returns a consistent JSON envelope so the frontend never sees
 * an HTML error page or unpredictable shape.
 */
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message;

  console.error(`[ERROR] ${err.stack ?? err.message}`);

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

/**
 * 404 handler — must be registered AFTER all routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
}

/**
 * Utility: create an error with a custom HTTP status code.
 */
export function createHttpError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  return err;
}
