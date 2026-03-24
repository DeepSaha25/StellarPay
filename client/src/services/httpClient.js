/**
 * HTTP Client with Request/Response Interceptors and Automatic Retry Logic
 * Provides reliable API communication with exponential backoff retry mechanism
 */

/**
 * Configuration for retry behavior
 */
const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_MULTIPLIER: 2,
  // Retry on these HTTP status codes
  RETRYABLE_STATUS_CODES: [408, 429, 500, 502, 503, 504],
  // Retry on these error types
  RETRYABLE_ERRORS: ['network', 'timeout'],
};

/**
 * HTTP Client class with built-in interceptors and retry logic
 */
class HTTPClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
  }

  /**
   * Add request interceptor
   * @param {Function} interceptor - (config) => config
   */
  addRequestInterceptor(interceptor) {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   * @param {Function} interceptor - (response) => response
   */
  addResponseInterceptor(interceptor) {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Add error interceptor
   * @param {Function} interceptor - (error) => throw error
   */
  addErrorInterceptor(interceptor) {
    this.errorInterceptors.push(interceptor);
  }

  /**
   * Execute request interceptors
   */
  async executeRequestInterceptors(config) {
    let updatedConfig = { ...config };
    for (const interceptor of this.requestInterceptors) {
      updatedConfig = await interceptor(updatedConfig);
    }
    return updatedConfig;
  }

  /**
   * Execute response interceptors
   */
  async executeResponseInterceptors(response) {
    let updatedResponse = response;
    for (const interceptor of this.responseInterceptors) {
      updatedResponse = await interceptor(updatedResponse);
    }
    return updatedResponse;
  }

  /**
   * Execute error interceptors
   */
  async executeErrorInterceptors(error) {
    let processedError = error;
    for (const interceptor of this.errorInterceptors) {
      try {
        processedError = await interceptor(processedError);
      } catch (interceptorError) {
        processedError = interceptorError;
      }
    }
    return processedError;
  }

  /**
   * Calculate delay with exponential backoff
   */
  getRetryDelay(retryCount) {
    const delay = Math.min(
      RETRY_CONFIG.INITIAL_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, retryCount),
      RETRY_CONFIG.MAX_DELAY_MS
    );
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * delay * 0.1;
    return delay + jitter;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error, status) {
    if (status && RETRY_CONFIG.RETRYABLE_STATUS_CODES.includes(status)) {
      return true;
    }
    if (error.message && RETRY_CONFIG.RETRYABLE_ERRORS.some(type => error.message.includes(type))) {
      return true;
    }
    return false;
  }

  /**
   * Perform HTTP request with retry logic
   */
  async request(url, options = {}, retryCount = 0) {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    let config = {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : undefined,
      ...options,
    };

    try {
      // Execute request interceptors
      config = await this.executeRequestInterceptors(config);

      // Make request
      const response = await fetch(fullURL, config);

      // Execute response interceptors
      const processedResponse = await this.executeResponseInterceptors(response);

      // Check if response is OK
      if (!processedResponse.ok) {
        const error = new Error(`HTTP Error: ${processedResponse.status}`);
        error.status = processedResponse.status;
        error.response = processedResponse;

        // Retry if applicable
        if (this.isRetryable(error, processedResponse.status) && retryCount < RETRY_CONFIG.MAX_RETRIES) {
          const delay = this.getRetryDelay(retryCount);
          console.warn(
            `[API Retry] ${config.method} ${fullURL} failed with ${processedResponse.status}. ` +
            `Retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/${RETRY_CONFIG.MAX_RETRIES})`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.request(url, options, retryCount + 1);
        }

        throw error;
      }

      // Parse response
      const contentType = processedResponse.headers.get('content-type');
      const data = contentType?.includes('application/json')
        ? await processedResponse.json()
        : await processedResponse.text();

      return { success: true, data, status: processedResponse.status };
    } catch (error) {
      // Execute error interceptors
      const processedError = await this.executeErrorInterceptors(error);

      // Retry on network/timeout errors
      if (this.isRetryable(processedError) && retryCount < RETRY_CONFIG.MAX_RETRIES) {
        const delay = this.getRetryDelay(retryCount);
        console.warn(
          `[API Retry] ${config.method} ${fullURL} failed: ${processedError.message}. ` +
          `Retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/${RETRY_CONFIG.MAX_RETRIES})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request(url, options, retryCount + 1);
      }

      return { success: false, error: processedError.message, status: error.status };
    }
  }

  /**
   * GET request helper
   */
  get(url, headers = {}) {
    return this.request(url, { method: 'GET', headers });
  }

  /**
   * POST request helper
   */
  post(url, body, headers = {}) {
    return this.request(url, { method: 'POST', body, headers });
  }

  /**
   * PUT request helper
   */
  put(url, body, headers = {}) {
    return this.request(url, { method: 'PUT', body, headers });
  }

  /**
   * DELETE request helper
   */
  delete(url, headers = {}) {
    return this.request(url, { method: 'DELETE', headers });
  }
}

/**
 * Create and configure default HTTP client
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_KEY = import.meta.env.VITE_API_KEY || '';

const httpClient = new HTTPClient(API_BASE_URL);

/**
 * Request Interceptor: Add authentication headers
 */
httpClient.addRequestInterceptor((config) => {
  if (API_KEY) {
    config.headers = config.headers || {};
    config.headers['X-API-Key'] = API_KEY;
  }
  config.headers['Content-Type'] = 'application/json';
  
  console.debug(`[API Request] ${config.method} ${config.url || ''}`);
  return config;
});

/**
 * Response Interceptor: Log successful responses
 */
httpClient.addResponseInterceptor((response) => {
  console.debug(`[API Response] ${response.status} ${response.statusText}`);
  return response;
});

/**
 * Error Interceptor: Log errors
 */
httpClient.addErrorInterceptor((error) => {
  console.error(`[API Error] ${error.message}`);
  throw error;
});

export default httpClient;
export { HTTPClient, RETRY_CONFIG };
