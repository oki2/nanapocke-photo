import {AppError} from "./AppError";

export class ValidationError extends AppError {
  constructor(message: string, issues?: unknown[]) {
    super(message, 400, "VALIDATION_ERROR", issues);
  }
}
