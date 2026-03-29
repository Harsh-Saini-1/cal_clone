import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Validates express-validator results and short-circuits with 400
 * if any field fails. Must be placed AFTER the validator chain in
 * route definitions.
 */
export function validate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((e) => ({
        field: e.type === 'field' ? e.path : 'unknown',
        message: e.msg,
      })),
    });
    return;
  }
  next();
}
