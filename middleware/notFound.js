import { NotFoundError } from '../errors/index.js';

const notFound = (req, res, next) => {
  const error = new NotFoundError(`Not Found - ${req.originalUrl}`);
  next(error);
};

export { notFound };
