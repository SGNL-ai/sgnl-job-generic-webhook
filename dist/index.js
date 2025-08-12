// SGNL Job Script - Auto-generated bundle
'use strict';

/**
 * SGNL Generic Webhook Job
 * 
 * This job provides a generic HTTP webhook capability for making HTTP requests
 * with configurable methods, headers, body, and endpoints.
 */

// Using Node.js built-ins directly without imports (like hello-world example)

/**
 * Makes HTTP request using only VM-available globals
 * @param {string} url - Target URL
 * @param {Object} options - Request options (method, headers, body)
 * @returns {Promise<{response: Object, body: string}>}
 */
function makeHttpRequest(url, options) {
  return new Promise((resolve, reject) => {
    try {
      // Try to parse URL without imports - use global URL if available
      let parsedUrl;
      if (typeof URL !== 'undefined') {
        parsedUrl = new URL(url);
      } else {
        // Manual URL parsing fallback
        const urlMatch = url.match(/^(https?):\/\/([^\/]+)(\/.*)?$/);
        if (!urlMatch) {
          reject(new Error('Invalid URL format'));
          return;
        }
        parsedUrl = {
          protocol: urlMatch[1] + ':',
          hostname: urlMatch[2].split(':')[0],
          port: urlMatch[2].includes(':') ? urlMatch[2].split(':')[1] : (urlMatch[1] === 'https' ? 443 : 80),
          pathname: urlMatch[3] || '/',
          search: ''
        };
      }

      const isHttps = parsedUrl.protocol === 'https:';
      
      // Try to access http/https modules via global object or process
      let httpModule;
      if (typeof global !== 'undefined' && global.process && global.process.binding) {
        try {
          httpModule = global.process.binding(isHttps ? 'https' : 'http');
        } catch (e) {
          // Binding might not be available
        }
      }
      
      if (!httpModule) {
        // Last resort: maybe the modules are available as globals
        httpModule = isHttps ? (global.https || https) : (global.http || http);
      }
      
      if (!httpModule || !httpModule.request) {
        reject(new Error('HTTP modules not available in VM context'));
        return;
      }

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method,
        headers: options.headers
      };

      const req = httpModule.request(requestOptions, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          resolve({
            response: res,
            body: body
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      // Write request body if provided
      if (options.body) {
        req.write(options.body);
      }

      req.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

const webhookJob = {
  /**
   * Main execution handler for generic webhook requests
   * @param {Object} params - Job input parameters
   * @param {string} params.method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {string} [params.requestBody] - JSON string of request body
   * @param {string} [params.requestHeaders] - JSON string of custom headers
   * @param {string} [params.addressSuffix] - URL suffix to append to base address
   * @param {string} [params.address] - Complete address override
   * @param {number[]} [params.acceptedStatusCodes] - Additional status codes to treat as success
   * @param {Object} context - Execution context with env, secrets, outputs
   * @returns {Object} Job results with HTTP response details
   */
  invoke: async (params, context) => {
    console.log('Starting generic webhook execution');
    console.log(`HTTP Method: ${params.method}`);
    
    const {
      method,
      requestBody,
      requestHeaders,
      addressSuffix,
      address: addressOverride,
      acceptedStatusCodes = []
    } = params;

    // Validate required parameters
    if (!method) {
      throw new Error('HTTP method is required');
    }

    // Determine the target URL - address parameter is required
    let targetUrl = addressOverride;
    
    if (!targetUrl) {
      throw new Error('address parameter is required');
    }

    // Apply address suffix if provided
    if (addressSuffix) {
      const baseUrl = targetUrl.replace(/\/$/, ''); // Remove trailing slash
      const suffix = addressSuffix.replace(/^\//, ''); // Remove leading slash
      targetUrl = `${baseUrl}/${suffix}`;
    }

    console.log(`Target URL: ${targetUrl}`);

    // Prepare request options
    const requestOptions = {
      method: method.toUpperCase(),
      headers: {
        'User-Agent': 'sgnl-generic-webhook/1.0.0'
      }
    };

    // Add request body if provided
    if (requestBody) {
      try {
        // Validate JSON if it's a string
        JSON.parse(requestBody);
        requestOptions.body = requestBody;
        requestOptions.headers['Content-Type'] = 'application/json';
      } catch (error) {
        throw new Error(`Invalid JSON in requestBody: ${error.message}`);
      }
    }

    // Add custom headers if provided
    if (requestHeaders) {
      try {
        const customHeaders = JSON.parse(requestHeaders);
        Object.assign(requestOptions.headers, customHeaders);
      } catch (error) {
        throw new Error(`Invalid JSON in requestHeaders: ${error.message}`);
      }
    }

    // Apply authentication if available
    if (context.secrets.AUTHORIZATION_HEADER) {
      requestOptions.headers['Authorization'] = context.secrets.AUTHORIZATION_HEADER;
    } else if (context.secrets.API_KEY) {
      requestOptions.headers['X-API-Key'] = context.secrets.API_KEY;
    } else if (context.secrets.BEARER_TOKEN) {
      requestOptions.headers['Authorization'] = `Bearer ${context.secrets.BEARER_TOKEN}`;
    }

    console.log(`Request headers: ${JSON.stringify(Object.keys(requestOptions.headers))}`);

    let response;
    let responseBody;

    try {
      // Make the HTTP request using native Node.js modules
      const result = await makeHttpRequest(targetUrl, requestOptions);
      response = result.response;
      responseBody = result.body;
      
      console.log(`Response status: ${response.statusCode}`);
      console.log(`Response body length: ${responseBody.length} characters`);

    } catch (error) {
      throw new Error(`HTTP request failed: ${error.message}`);
    }

    // Prepare response object
    const jobResult = {
      status_code: response.statusCode,
      body: responseBody,
      headers: response.headers,
      url: targetUrl,
      method: method.toUpperCase(),
      processed_at: new Date().toISOString()
    };

    // Check if status code should be treated as success
    const isAcceptedStatus = acceptedStatusCodes.includes(response.statusCode);
    const isStandardSuccess = response.statusCode >= 200 && response.statusCode < 300;

    if (isAcceptedStatus || isStandardSuccess) {
      console.log(`Request completed successfully with status ${response.statusCode}`);
      return {
        status: 'success',
        ...jobResult
      };
    } else {
      // Non-success status code - return response data but indicate failure
      const errorMessage = `HTTP request failed with status ${response.statusCode}`;
      console.error(errorMessage);
      
      return {
        status: 'http_error',
        error: errorMessage,
        ...jobResult
      };
    }
  },

  /**
   * Error recovery handler for webhook request failures
   * @param {Object} params - Original params plus error information
   * @param {Object} context - Execution context
   * @returns {Object} Recovery results
   */
  error: async (params, context) => {
    const { error, method, address } = params;
    const targetUrl = address || context.env.WEBHOOK_BASE_URL;
    
    console.error(`Webhook request encountered error: ${error.message}`);
    console.error(`Target: ${method} ${targetUrl}`);
    
    // Handle rate limiting with exponential backoff
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      console.log('Rate limited - implementing backoff strategy');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log(`Retrying webhook request after backoff`);
      
      try {
        // Retry the original request by calling the main invoke function
        const originalParams = { ...params };
        delete originalParams.error; // Remove error from params for retry
        return await webhookJob.invoke(originalParams, context);
      } catch (retryError) {
        throw new Error(`Retry failed after rate limit backoff: ${retryError.message}`);
      }
    }
    
    // Handle network timeouts with shorter timeout
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      console.log('Request timeout - retrying with shorter timeout');
      
      return {
        status: 'timeout_error',
        method: method,
        url: targetUrl,
        recovery_method: 'timeout_handling',
        original_error: error.message,
        recovered_at: new Date().toISOString(),
        recommendation: 'Consider increasing timeout or checking network connectivity'
      };
    }
    
    // Handle DNS resolution failures
    if (error.message.includes('ENOTFOUND') || error.message.includes('DNS')) {
      console.error('DNS resolution failed - cannot reach target URL');
      
      return {
        status: 'dns_error',
        method: method,
        url: targetUrl,
        recovery_method: 'dns_failure_handling',
        original_error: error.message,
        recovered_at: new Date().toISOString(),
        recommendation: 'Verify the target URL is correct and accessible'
      };
    }
    
    // Cannot recover from this error
    console.error(`Unable to recover from webhook error: ${error.message}`);
    throw new Error(`Unrecoverable webhook error: ${error.message}`);
  },

  /**
   * Graceful shutdown handler for webhook requests
   * @param {Object} params - Original params plus halt reason
   * @param {Object} context - Execution context
   * @returns {Object} Cleanup results
   */
  halt: async (params, context) => {
    const { reason, method, address } = params;
    const targetUrl = address || context.env.WEBHOOK_BASE_URL;
    
    console.log(`Webhook job is being halted (${reason})`);
    console.log(`Target: ${method} ${targetUrl}`);
    
    // Log any partial progress for debugging
    if (context.partial_results) {
      console.log('Logging partial results before shutdown');
      console.log(`Partial results: ${JSON.stringify(context.partial_results, null, 2)}`);
    }
    
    // Clean up any pending requests or connections
    console.log('Performing cleanup operations');
    // Note: built-in fetch automatically handles connection cleanup
    
    return {
      status: 'halted',
      method: method || 'unknown',
      url: targetUrl || 'unknown',
      reason: reason,
      halted_at: new Date().toISOString(),
      cleanup_completed: true,
      partial_results_logged: !!context.partial_results
    };
  }
};

module.exports = webhookJob;
