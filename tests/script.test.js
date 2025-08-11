import { jest } from '@jest/globals';

// Mock node-fetch
const mockFetch = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch
}));

// Import the script after mocking
const script = await import('../src/script.mjs');

describe('Generic Webhook Job', () => {
  const mockContext = {
    env: {
      WEBHOOK_BASE_URL: 'https://api.example.com'
    },
    secrets: {
      API_KEY: 'test-api-key-123456'
    },
    outputs: {},
    partial_results: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('invoke handler', () => {
    test('should execute GET request successfully', async () => {
      const mockResponse = {
        status: 200,
        text: jest.fn().mockResolvedValue('{"success": true}'),
        headers: {
          entries: () => [['content-type', 'application/json']]
        }
      };
      mockFetch.mockResolvedValue(mockResponse);

      const params = {
        method: 'GET',
        addressSuffix: '/users'
      };

      const result = await script.default.invoke(params, mockContext);

      expect(result.status).toBe('success');
      expect(result.status_code).toBe(200);
      expect(result.method).toBe('GET');
      expect(result.url).toBe('https://api.example.com/users');
      expect(result.processed_at).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': 'sgnl-generic-webhook/1.0.0',
            'X-API-Key': 'test-api-key-123456'
          })
        })
      );
    });

    test('should execute POST request with body and custom headers', async () => {
      const mockResponse = {
        status: 201,
        text: jest.fn().mockResolvedValue('{"id": 123}'),
        headers: {
          entries: () => [['content-type', 'application/json']]
        }
      };
      mockFetch.mockResolvedValue(mockResponse);

      const params = {
        method: 'POST',
        address: 'https://api.test.com/users',
        requestBody: '{"name": "John Doe", "email": "john@example.com"}',
        requestHeaders: '{"Content-Type": "application/json", "X-Custom": "value"}'
      };

      const result = await script.default.invoke(params, mockContext);

      expect(result.status).toBe('success');
      expect(result.status_code).toBe(201);
      expect(result.method).toBe('POST');
      expect(result.url).toBe('https://api.test.com/users');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/users',
        expect.objectContaining({
          method: 'POST',
          body: '{"name": "John Doe", "email": "john@example.com"}',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'value',
            'X-API-Key': 'test-api-key-123456'
          })
        })
      );
    });

    test('should handle HTTP error with custom accepted status codes', async () => {
      const mockResponse = {
        status: 404,
        text: jest.fn().mockResolvedValue('Not Found'),
        headers: {
          entries: () => [['content-type', 'text/plain']]
        }
      };
      mockFetch.mockResolvedValue(mockResponse);

      const params = {
        method: 'DELETE',
        addressSuffix: '/users/123',
        acceptedStatusCodes: [404]
      };

      const result = await script.default.invoke(params, mockContext);

      expect(result.status).toBe('success');
      expect(result.status_code).toBe(404);
      expect(result.method).toBe('DELETE');
    });

    test('should handle HTTP error without accepted status codes', async () => {
      const mockResponse = {
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
        headers: {
          entries: () => [['content-type', 'text/plain']]
        }
      };
      mockFetch.mockResolvedValue(mockResponse);

      const params = {
        method: 'POST',
        requestBody: '{"test": true}'
      };

      const result = await script.default.invoke(params, mockContext);

      expect(result.status).toBe('http_error');
      expect(result.error).toContain('HTTP request failed with status 500');
      expect(result.status_code).toBe(500);
    });

    test('should throw error for missing method', async () => {
      const params = {
        addressSuffix: '/users'
      };

      await expect(script.default.invoke(params, mockContext)).rejects.toThrow('HTTP method is required');
    });

    test('should throw error for missing URL', async () => {
      const params = {
        method: 'GET'
      };

      const contextNoUrl = { ...mockContext, env: {} };

      await expect(script.default.invoke(params, contextNoUrl)).rejects.toThrow(
        'Either address parameter or WEBHOOK_BASE_URL environment variable must be provided'
      );
    });

    test('should throw error for invalid JSON in requestBody', async () => {
      const params = {
        method: 'POST',
        requestBody: '{"invalid": json}'
      };

      await expect(script.default.invoke(params, mockContext)).rejects.toThrow('Invalid JSON in requestBody');
    });

    test('should throw error for invalid JSON in requestHeaders', async () => {
      const params = {
        method: 'GET',
        requestHeaders: '{"invalid": json}'
      };

      await expect(script.default.invoke(params, mockContext)).rejects.toThrow('Invalid JSON in requestHeaders');
    });
  });

  describe('error handler', () => {
    test('should handle timeout errors', async () => {
      const params = {
        method: 'GET',
        address: 'https://api.example.com',
        error: {
          message: 'Request timeout - ETIMEDOUT'
        }
      };

      const result = await script.default.error(params, mockContext);

      expect(result.status).toBe('timeout_error');
      expect(result.method).toBe('GET');
      expect(result.recovery_method).toBe('timeout_handling');
      expect(result.original_error).toContain('timeout');
    });

    test('should handle DNS errors', async () => {
      const params = {
        method: 'POST',
        address: 'https://nonexistent.example.com',
        error: {
          message: 'DNS resolution failed - ENOTFOUND'
        }
      };

      const result = await script.default.error(params, mockContext);

      expect(result.status).toBe('dns_error');
      expect(result.method).toBe('POST');
      expect(result.recovery_method).toBe('dns_failure_handling');
      expect(result.recommendation).toContain('Verify the target URL');
    });

    test('should throw for unrecoverable errors', async () => {
      const params = {
        method: 'GET',
        address: 'https://api.example.com',
        error: {
          message: 'Invalid SSL certificate'
        }
      };

      await expect(script.default.error(params, mockContext)).rejects.toThrow('Unrecoverable webhook error');
    });
  });

  describe('halt handler', () => {
    test('should handle graceful shutdown', async () => {
      const params = {
        method: 'GET',
        address: 'https://api.example.com',
        reason: 'timeout'
      };

      const result = await script.default.halt(params, mockContext);

      expect(result.status).toBe('halted');
      expect(result.method).toBe('GET');
      expect(result.url).toBe('https://api.example.com');
      expect(result.reason).toBe('timeout');
      expect(result.cleanup_completed).toBe(true);
      expect(result.halted_at).toBeDefined();
    });

    test('should log partial results when available', async () => {
      const contextWithPartialResults = {
        ...mockContext,
        partial_results: {
          request_started: true,
          headers_sent: true
        }
      };

      const params = {
        method: 'POST',
        reason: 'cancellation'
      };

      const result = await script.default.halt(params, contextWithPartialResults);

      expect(result.status).toBe('halted');
      expect(result.partial_results_logged).toBe(true);
      expect(result.reason).toBe('cancellation');
    });
  });
});