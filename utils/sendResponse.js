/**
 * Send standardized API response
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {string} options.status - Response status ('success' or 'error')
 * @param {number} options.code - HTTP status code
 * @param {string} options.message - Response message
 * @param {Object} options.data - Response data
 * @param {Object} options.meta - Additional metadata (pagination, etc.)
 */
const sendResponse = (
  res,
  {
    status = 'success',
    code = 200,
    message = null,
    data = {},
    meta = null
  } = {}
) => {
  const response = {
    success: status === 'success',
    status
  };

  if (message) {
    response.message = message;
  }

  // Add data to response
  if (Object.keys(data).length > 0 || Array.isArray(data)) {
    response.data = data;
  }

  // Add metadata (pagination, etc.)
  if (meta) {
    response.meta = meta;
  }

  return res.status(code).json(response);
};

export default sendResponse;

