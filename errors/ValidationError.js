import AppError from './AppError.js';

class ValidationError extends AppError {
  constructor(message = 'Validation Error', errors = []) {
    super(message, 400);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export default ValidationError;

