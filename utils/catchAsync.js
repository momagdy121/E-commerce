/**
 * Wrapper function to catch errors in async route handlers
 * Eliminates the need for try-catch blocks in every controller
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware function
 * 
 * @example
 * export const getUsers = catchAsync(async (req, res, next) => {
 *   const users = await User.find();
 *   sendResponse(res, { data: users });
 * });
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default catchAsync;

