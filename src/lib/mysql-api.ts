import { apiFetch, ApiError, formatApiErrorMessage } from "./api";

/**
 * =========================
 * TIPOS
 * =========================
 */

export interface MysqlApiResponse<T> {
  success: boolean;

  data: T;

  message?: string;
}

export interface MysqlApiError {
  error: string;

  status?: number;
}

/**
 * =========================
 * MYSQL API
 * =========================
 */

export const mysqlApi = {
  /**
   * GET
   */
  async get<T = any>(endpoint: string): Promise<T> {
    try {
      return await apiFetch(endpoint, {
        method: "GET",
      });
    } catch (error) {
      console.error("mysqlApi GET error:", error);

      throw new ApiError(formatApiErrorMessage(error));
    }
  },

  /**
   * POST
   */
  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    try {
      return await apiFetch(endpoint, {
        method: "POST",

        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error("mysqlApi POST error:", error);

      throw new ApiError(formatApiErrorMessage(error));
    }
  },

  /**
   * PUT
   */
  async put<T = any>(endpoint: string, body?: any): Promise<T> {
    try {
      return await apiFetch(endpoint, {
        method: "PUT",

        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error("mysqlApi PUT error:", error);

      throw new ApiError(formatApiErrorMessage(error));
    }
  },

  /**
   * DELETE
   */
  async delete<T = any>(endpoint: string): Promise<T> {
    try {
      return await apiFetch(endpoint, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("mysqlApi DELETE error:", error);

      throw new ApiError(formatApiErrorMessage(error));
    }
  },

  async del<T = any>(endpoint: string): Promise<T> {
    return this.delete<T>(endpoint);
  },
};
