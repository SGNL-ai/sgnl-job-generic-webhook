/**
 * SGNL Generic Webhook Job
 * 
 * Makes HTTP requests to external APIs and services with configurable methods,
 * headers, and request bodies.
 */

/**
 * Makes HTTP request using native fetch
 * @param {string} method - HTTP method
 * @param {string} url - Target URL
 * @param {Object} headers - Request headers
 * @param {string} body - Request body
 * @param {number[]} acceptedStatusCodes - Additional success codes
 * @returns {Promise<Object>} HTTP response details
 */
async function makeWebhookRequest(method, url, headers = {}, body = null, acceptedStatusCodes = []) {
  console.log(`Making ${method} request to ${url}`);
  
  const requestOptions = {
    method: method,
    headers: headers
  };

  // Add body for methods that support it
  if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    requestOptions.body = body;
    
    // Set content type if not already specified
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  try {
    const response = await fetch(url, requestOptions);
    const responseBody = await response.text();
    
    // Determine if request was successful
    const isSuccess = response.ok || acceptedStatusCodes.includes(response.status);
    
    console.log(`Response status: ${response.status}, Success: ${isSuccess}`);
    
    return {
      statusCode: response.status,
      body: responseBody,
      success: isSuccess,
      executedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    throw error;
  }
}

export default {
  /**
   * Main execution handler for generic webhook requests
   * @param {Object} params - Job input parameters
   * @param {Object} context - Execution context with env, secrets, outputs
   * @returns {Object} Job results with HTTP response details
   */
  invoke: async (params, context) => {
    console.log('Starting generic webhook job execution');
    
    const { method, address, requestBody, requestHeaders, acceptedStatusCodes = [] } = params;
    
    // Validate required parameters
    if (!method) {
      throw new Error('HTTP method is required');
    }
    
    if (!address) {
      throw new Error('address parameter is required');
    }
    
    // Prepare headers
    const headers = {
      'User-Agent': 'sgnl-generic-webhook/1.0.0'
    };
    
    // Add custom headers if provided
    if (requestHeaders) {
      try {
        const customHeaders = typeof requestHeaders === 'string' 
          ? JSON.parse(requestHeaders) 
          : requestHeaders;
        Object.assign(headers, customHeaders);
      } catch (error) {
        throw new Error(`Invalid JSON in requestHeaders: ${error.message}`);
      }
    }
    
    // Apply authentication from context secrets
    if (context.secrets?.AUTHORIZATION_HEADER) {
      headers['Authorization'] = context.secrets.AUTHORIZATION_HEADER;
    } else if (context.secrets?.API_KEY) {
      headers['X-API-Key'] = context.secrets.API_KEY;
    } else if (context.secrets?.BEARER_TOKEN) {
      headers['Authorization'] = `Bearer ${context.secrets.BEARER_TOKEN}`;
    }
    
    // Prepare request body
    let body = null;
    if (requestBody) {
      body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
    }
    
    // Make the HTTP request
    const result = await makeWebhookRequest(method, address, headers, body, acceptedStatusCodes);
    
    console.log(`Webhook request completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    
    return result;
  },

  /**
   * Error recovery handler for webhook request failures
   * @param {Object} params - Original params plus error information
   * @param {Object} context - Execution context
   * @returns {Object} Recovery results
   */
  error: async (params, context) => {
    const { error } = params;
    
    console.error('Webhook job error handler invoked:', error?.message || error);
    
    // Check if this is a retryable error (network issues)
    const isRetryable = error?.message?.includes('fetch') || 
                       error?.message?.includes('network') ||
                       error?.message?.includes('timeout');
    
    if (isRetryable) {
      console.log('Error appears to be network-related and potentially retryable');
      // Could implement retry logic here
    }
    
    // For now, just re-throw the error
    throw error;
  },

  /**
   * Graceful shutdown handler for webhook requests
   * @param {Object} params - Original params plus halt reason
   * @param {Object} context - Execution context
   * @returns {Object} Cleanup results
   */
  halt: async (params, context) => {
    const { reason } = params;
    
    console.log(`Webhook job halt handler invoked: ${reason}`);
    
    // Perform any necessary cleanup
    console.log('Cleaning up webhook job resources...');
    
    return {
      status: 'halted',
      reason: reason,
      halted_at: new Date().toISOString()
    };
  }
};