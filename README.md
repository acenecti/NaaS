# NaaS: Express.js Middleware for Chaos Engineering

[![NPM Version](https://img.shields.io/npm/v/naas.svg)](https://www.npmjs.com/package/naas)
[![Build Status](https://img.shields.io/travis/com/[yourusername]/naas.svg)](https://travis-ci.com/[yourusername]/naas)
[![Coverage Status](https://img.shields.io/coveralls/github/[yourusername]/naas.svg)](https://coveralls.io/github/[yourusername]/naas)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**NaaS** is a configurable Express.js middleware developed for chaos engineering practices.

---

## Installation

Install the package using npm or yarn:

```bash
npm install naas
```

or

```bash
yarn add naas
```

---

## Usage Guide

### Basic Integration

The `createNaaS` factory function provides a straightforward method for integrating the middleware.

```javascript
const express = require("express");
const createNaaS = require("naas"); // or: import { createNaaS } from 'naas';

const app = express();

// Initialize NaaS middleware (default: 10% fault rate)
const naasMiddleware = createNaaS();

// Apply middleware globally
app.use(naasMiddleware);

// Example route
app.get("/api/resource", (req, res) => {
  res.json({ data: "Resource data, subject to potential fault injection." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `Application server running on port ${PORT}. NaaS middleware active.`
  );
});
```

### Advanced Integration using the `NaaS` Class

For fine-grained control, such as runtime configuration updates, instantiate the `NaaS` class directly.

```javascript
const express = require("express");
const { NaaS } = require("naas"); // or: import { NaaS } from 'naas';

const app = express();

const naasInstance = new NaaS({
  errorRate: 15, // 15% of targeted requests will experience a fault
  targetRoutes: ["/api/critical/*"], // Apply only to routes under /api/critical/
  delays: {
    enabled: true,
    min: 200, // milliseconds
    max: 1500, // milliseconds
    probability: 40, // 40% chance of delay if request is selected for fault
  },
});

// Apply the middleware instance
app.use(naasInstance.middleware);

app.get("/api/critical/data", (req, res) => {
  res.json({ status: "Data retrieved successfully." });
});

// Example: Dynamically updating configuration
// This could be triggered via an internal API or monitoring system
setTimeout(() => {
  naasInstance.updateConfig({ errorRate: 5 });
  console.log("NaaS fault rate adjusted to 5%.");
}, 120000); // Adjust after 2 minutes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `Application server with advanced NaaS configuration running on port ${PORT}.`
  );
});
```

---

## Configuration Options

The middleware is configured by passing an options object to `createNaaS(options)` or `new NaaS(options)`.

| Option           | Type                      | Default Value                                                                                 | Description                                                                                                                                                           |
| ---------------- | ------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `errorRate`      | `number`                  | `10`                                                                                          | The probability (0-100) that a targeted request will result in a fault.                                                                                               |
| `targetRoutes`   | `Array<string \| RegExp>` | `[]`                                                                                          | Routes to which faults will be applied. Supports string patterns (exact/prefix match) or regular expressions. If empty, applies to all routes not in `excludeRoutes`. |
| `excludeRoutes`  | `Array<string \| RegExp>` | `[]`                                                                                          | Routes to be exempted from fault injection.                                                                                                                           |
| `targetMethods`  | `Array<string>`           | `["GET", "POST", "PUT", "DELETE", "PATCH"]`                                                   | HTTP methods eligible for fault injection.                                                                                                                            |
| `errors`         | `Array<ErrorObject>`      | See [Default Errors](https://www.google.com/search?q=%23default-errors-configuration)         | A list of error definitions, each with an HTTP status code, message, and selection weight.                                                                            |
| `delays`         | `Object`                  | See [Delay Configuration](https://www.google.com/search?q=%23delay-configuration-details)     | Parameters for injecting latency.                                                                                                                                     |
| `responseFormat` | `string`                  | `"json"`                                                                                      | Format for error responses: `"json"`, `"xml"`, or `"plain"`.                                                                                                          |
| `customHeaders`  | `Object`                  | `{}`                                                                                          | Custom HTTP headers to include in error responses.                                                                                                                    |
| `logging`        | `Object`                  | See [Logging Configuration](https://www.google.com/search?q=%23logging-configuration-details) | Settings for the internal logger.                                                                                                                                     |
| `environments`   | `Array<string>`           | `["development", "testing", "production"]`                                                    | Node.js environments (`process.env.NODE_ENV`) in which the middleware will be active.                                                                                 |
| `customChaos`    | `Array<AsyncFunction>`    | `[]`                                                                                          | Array of user-defined asynchronous functions `(req, res) => Promise<boolean \| void>` for custom fault logic. A return of `false` halts NaaS processing for the request. |

### Default `errors` Configuration

```javascript
[
  { code: 500, message: "Internal Server Error", weight: 30 },
  { code: 503, message: "Service Unavailable", weight: 25 },
  { code: 502, message: "Bad Gateway", weight: 20 },
  { code: 504, message: "Gateway Timeout", weight: 10 },
  { code: 429, message: "Too Many Requests", weight: 10 },
  { code: 404, message: "Not Found", weight: 3 },
  { code: 403, message: "Forbidden", weight: 2 },
];
```

- `code`: HTTP status code.
- `message`: Error message text.
- `weight`: Relative probability influencing the selection of this error.

### `delays` Configuration Details

- `enabled` (`boolean`): If `true`, latency injection is active. Default: `true`.
- `min` (`number`): Minimum delay in milliseconds. Default: `100`.
- `max` (`number`): Maximum delay in milliseconds. Default: `5000`.
- `probability` (`number`): Probability (0-100) of applying a delay if the request is selected for a fault and delays are enabled. Default: `30`.

### `logging` Configuration Details

- `enabled` (`boolean`): If `true`, NaaS will log its actions. Default: `true`.
- `level` (`string`): Default log level (e.g., "info", "error"). Default: `"info"`.
- `logger` (`Object`): A logger instance (e.g., `console`, Winston) with methods like `.log()`, `.info()`, `.error()`. Default: `console`.

---

## API Reference

### `createNaaS(options?: NaaSConfig): ExpressMiddleware`

Factory function that instantiates and returns a NaaS middleware configured with the provided options.

### `NaaS` Class Methods

An instance of the `NaaS` class provides the following methods:

#### `constructor(options?: NaaSConfig)`

Initializes a new `NaaS` instance with the specified configuration.

#### `naasInstance.middleware(req, res, next): Promise<void>`

The Express.js middleware function to be integrated into the application's request pipeline.

#### `naasInstance.updateConfig(newConfig: Partial<NaaSConfig>): void`

Dynamically updates the instance's configuration. Unspecified options in `newConfig` retain their current values. The configuration is re-validated after updates.

#### `naasInstance.getStats(): object`

Returns an object detailing the current configuration, active `NODE_ENV`, and NaaS version.

```javascript
{
  config: { /* Current NaaS configuration object */ },
  environment: 'development', // Example value
  version: '1.0.0'
}
```

#### `naasInstance.disable(): void`

Temporarily deactivates fault injection by setting `errorRate` to `0`. The original `errorRate` is preserved for potential re-activation.

#### `naasInstance.enable(): void`

Restores the `errorRate` to its value prior to `disable()` being called, effectively re-activating fault injection.

---

## Example Server Execution

The `package.json` includes a script to run an example Express server, typically located at `example/server.js`.

```bash
npm start
```

Ensure `example/server.js` is present and configured to use the NaaS middleware.

---

## Development and Testing

### System Prerequisites

- Node.js version \>= 14.0.0

### Available Scripts

- **Code Linting:**
  ```bash
  npm run lint
  ```
- **Automated Tests:**
  ```bash
  npm test              # Execute tests
  npm run test:watch    # Execute tests in watch mode for continuous development
  ```

---

## Contribution Guidelines

Contributions aimed at improving the functionality and reliability of this tool are welcome. Please adhere to the following process:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix (`git checkout -b feature/my-enhancement` or `bugfix/issue-fix`).
3.  Implement your changes and include appropriate tests.
4.  Ensure all tests pass (`npm test`) and linting checks are clean (`npm run lint`).
5.  Commit your changes with clear, descriptive messages.
6.  Push your branch to your fork (`git push origin feature/my-enhancement`).
7.  Submit a pull request to the main repository for review.

---

## License

This project is licensed under the MIT License. Consult the `LICENSE` file for detailed information.
(Ensure a `LICENSE` file containing the MIT License text is present in your repository.)

---

## Issue Reporting and Support

To report issues, request features, or seek support, please open an issue on the GitHub repository:
[https://github.com/[yourusername]/naas/issues](https://www.google.com/search?q=https://github.com/%5Byourusername%5D/naas/issues)
