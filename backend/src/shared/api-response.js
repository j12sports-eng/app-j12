function createApiResponse({
  code = null,
  data = null,
  errors = null,
  message = null,
  meta = null,
  requestId = null,
  success = true,
  timestamp = new Date().toISOString(),
} = {}) {
  const response = {
    success,
    timestamp,
  };

  if (message != null) response.message = message;
  if (code != null) response.code = code;
  if (data != null) response.data = data;
  if (errors != null) response.errors = errors;
  if (meta != null) response.meta = meta;
  if (requestId != null) response.requestId = requestId;

  return response;
}

function createSuccessResponse(data, options = {}) {
  return createApiResponse({
    ...options,
    data,
    success: true,
  });
}

function createErrorResponse(message, options = {}) {
  return createApiResponse({
    ...options,
    message,
    success: false,
  });
}

module.exports = {
  createApiResponse,
  createErrorResponse,
  createSuccessResponse,
};
