import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { message: err.message, code: err.code },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      },
    });
  }

  logger.error({ err, message: err.message, stack: err.stack }, 'Unhandled error');

  return res.status(500).json({
    success: false,
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
  });
}
