export const successResponse = (message: string, data: unknown = {}) => ({
  success: true as const,
  message,
  data,
});

export const errorResponse = (
  message: string,
  errors?: Record<string, string>,
) => ({
  success: false as const,
  message,
  ...(errors !== undefined && { errors }),
});
