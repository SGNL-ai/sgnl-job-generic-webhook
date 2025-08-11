# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Node.js 20 generic webhook job** that provides HTTP request capabilities for the SGNL Job Service. This job allows making configurable HTTP requests to external APIs and services with support for custom methods, headers, request bodies, and response handling.

## Repository Structure

```
sgnl-job-generic-webhook/
├── src/
│   └── script.mjs     # Main webhook job implementation
├── tests/             # Unit tests for the webhook job
├── scripts/           # Development and validation scripts
├── dist/              # Built job distribution
├── metadata.yaml      # Job parameter specifications
├── package.json       # Node.js dependencies and scripts
└── README.md          # Documentation
```

## Job Type

This job is specifically for the **nodejs-22** job type:

- **Runtime**: Node.js 22 with modern JavaScript/TypeScript support
- **Purpose**: HTTP webhook requests to external APIs and services
- **Container**: Optimized distroless Node.js 22 runtime environment

## Webhook Job Usage

### Making HTTP Requests

The generic webhook job supports various HTTP operations:

1. **GET requests** - Retrieve data from APIs
2. **POST requests** - Send data to APIs (with JSON body)
3. **PUT/PATCH requests** - Update resources
4. **DELETE requests** - Remove resources
5. **Custom methods** - Any HTTP method supported by the target service

### Job Parameters

The webhook job accepts these parameters:

```yaml
method: "POST"                    # Required - HTTP method
address: "https://api.example.com" # Required - target URL for the request
addressSuffix: "/api/v1/users"    # Optional - path to append to base URL
requestBody: '{"name": "John"}'   # Optional - JSON request body
requestHeaders: '{"X-API-Key": "secret"}' # Optional - custom headers
acceptedStatusCodes: [404, 410]   # Optional - additional success codes
```

### Environment Variables

- `AUTHORIZATION_HEADER` - Authorization header value (takes precedence)
- `API_KEY` - API key sent as X-API-Key header
- `BEARER_TOKEN` - Bearer token for Authorization header

## Development Guidelines

### Best Practices for Webhook Jobs

- **Validate input parameters** - Always validate method, URL format, and JSON strings
- **Handle HTTP errors gracefully** - Return detailed error information for debugging
- **Use structured logging** - Log request/response details for monitoring
- **Set appropriate timeouts** - Consider target service response times
- **Secure authentication** - Use environment variables for sensitive credentials
- **Handle edge cases** - Network timeouts, DNS failures, rate limiting
- **Validate JSON** - Parse and validate JSON strings for requestBody and requestHeaders

### Required Labels for Logging

For proper log aggregation, ensure webhook jobs emit structured logs with these labels:
- `service="job-service"`
- `job_id="<job-id>"`
- `tenant_id="<tenant-id>"`

### Environment Variables Available

Webhook jobs have access to these environment variables:
- `JOB_ID` - Unique identifier for the job instance
- `JOB_TYPE` - Always "nodejs-22" for this job
- `TENANT_ID` - Tenant identifier
- `WORKER_ID` - ID of the worker executing the job

## Testing the Webhook Job

### Local Testing

1. Set up the job service development environment
2. Configure test endpoints or use tools like httpbin.org
3. Test various HTTP methods and response codes
4. Validate JSON parsing for requestBody and requestHeaders
5. Test authentication mechanisms

### Integration Testing

- Test successful HTTP requests with various methods (GET, POST, PUT, DELETE)
- Test error scenarios (404, 500, timeout, DNS failure)
- Test custom headers and request body handling
- Test acceptedStatusCodes parameter
- Test authentication with different credential types
- Validate response data structure and logging

## Related Repositories

- **job_service** - Main job execution infrastructure
- **sgnl-job-hello-world** - Simple "hello world" job example

## Usage Examples

### Basic GET Request
```yaml
method: "GET"
address: "https://jsonplaceholder.typicode.com/posts/1"
```

### POST with JSON Body
```yaml
method: "POST"
address: "https://httpbin.org/post"
requestBody: '{"message": "Hello from SGNL", "timestamp": "2024-01-01T00:00:00Z"}'
requestHeaders: '{"Content-Type": "application/json", "X-Custom-Header": "value"}'
```

### DELETE with Custom Success Codes
```yaml
method: "DELETE"
addressSuffix: "/api/users/123"
acceptedStatusCodes: [404, 410]  # Treat 404/410 as success for deletes
```

## Important Notes

- This webhook job supports all standard HTTP methods
- Always test webhook integrations in a development environment first
- Follow SGNL security guidelines for handling API credentials
- The job is idempotent for GET requests but may not be for others
- Use Node.js 20 features like ES modules and modern JavaScript

## Getting Help

- Test with public APIs like httpbin.org or jsonplaceholder.typicode.com
- Review the job service documentation for nodejs-22 job type details  
- Check the tests/ directory for usage examples
- Leverage Node.js 20 documentation for language features