class NaaS {
  constructor(options = {}) {
    this.config = {
      errorRate: options.errorRate || 10,
      targetRoutes: options.targetRoutes || [],
      excludeRoutes: options.excludeRoutes || [],
      targetMethods: options.targetMethods || [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH",
      ],
      errors: options.errors || [
        { code: 500, message: "Internal Server Error", weight: 30 },
        { code: 503, message: "Service Unavailable", weight: 25 },
        { code: 502, message: "Bad Gateway", weight: 20 },
        { code: 504, message: "Gateway Timeout", weight: 10 },
        { code: 429, message: "Too Many Requests", weight: 10 },
        { code: 404, message: "Not Found", weight: 3 },
        { code: 403, message: "Forbidden", weight: 2 },
      ],
      delays: options.delays || {
        enabled: true,
        min: 100,
        max: 5000,
        probability: 30,
      },
      responseFormat: options.responseFormat || "json",
      customHeaders: options.customHeaders || {},
      logging: {
        enabled: options.logging?.enabled !== false,
        level: options.logging?.level || "info",
        logger: options.logging?.logger || console,
      },
      environments: options.environments || [
        "development",
        "testing",
        "production",
      ],
      customChaos: options.customChaos || [],
    };

    this._validateConfig();
    this._normalizeErrorWeights();

    // Bind methods
    this.middleware = this.middleware.bind(this);
  }

  _validateConfig() {
    if (this.config.errorRate < 0 || this.config.errorRate > 100) {
      throw new Error("Error rate must be between 0 and 100");
    }

    if (!Array.isArray(this.config.errors) || this.config.errors.length === 0) {
      throw new Error("Errors configuration must be a non-empty array");
    }

    this.config.errors.forEach((error) => {
      if (!error.code || !error.message) {
        throw new Error("Each error must have a code and message");
      }
    });
  }

  _normalizeErrorWeights() {
    const totalWeight = this.config.errors.reduce(
      (sum, error) => sum + (error.weight || 1),
      0
    );
    this.config.errors.forEach((error) => {
      error.normalizedWeight = (error.weight || 1) / totalWeight;
    });
  }

  _shouldApplyChaos(req) {
    const env = process.env.NODE_ENV || "development";
    if (!this.config.environments.includes(env)) {
      return false;
    }

    if (!this.config.targetMethods.includes(req.method)) {
      return false;
    }

    if (
      this.config.excludeRoutes.some((route) =>
        this._matchesRoute(req.path, route)
      )
    ) {
      return false;
    }

    if (this.config.targetRoutes.length > 0) {
      if (
        !this.config.targetRoutes.some((route) =>
          this._matchesRoute(req.path, route)
        )
      ) {
        return false;
      }
    }

    return Math.random() * 100 < this.config.errorRate;
  }

  _matchesRoute(path, pattern) {
    if (typeof pattern === "string") {
      return path === pattern || path.startsWith(pattern);
    }
    if (pattern instanceof RegExp) {
      return pattern.test(path);
    }
    return false;
  }

  _selectRandomError() {
    const random = Math.random();
    let cumulative = 0;

    for (const error of this.config.errors) {
      cumulative += error.normalizedWeight;
      if (random <= cumulative) {
        return error;
      }
    }

    return this.config.errors[0];
  }

  _applyDelay() {
    if (!this.config.delays.enabled) {
      return Promise.resolve();
    }

    if (Math.random() * 100 > this.config.delays.probability) {
      return Promise.resolve();
    }

    const delay = Math.floor(
      Math.random() * (this.config.delays.max - this.config.delays.min) +
        this.config.delays.min
    );

    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  _formatErrorResponse(error, req) {
    const baseResponse = {
      error: {
        code: error.code,
        message: error.message,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        chaos: true,
        naas: "1.0.0",
      },
    };

    switch (this.config.responseFormat) {
      case "plain":
        return error.message;
      case "xml":
        return `<?xml version="1.0"?>
  <error>
    <code>${error.code}</code>
    <message>${error.message}</message>
    <timestamp>${baseResponse.error.timestamp}</timestamp>
    <path>${req.path}</path>
    <method>${req.method}</method>
  </error>`;
      case "json":
      default:
        return baseResponse;
    }
  }

  _log(level, message, meta = {}) {
    if (!this.config.logging.enabled) return;

    const logger = this.config.logging.logger;
    const logData = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: "naas",
      ...meta,
    };

    if (typeof logger[level] === "function") {
      logger[level](message, logData);
    } else {
      logger.log(logData);
    }
  }

  async middleware(req, res, next) {
    try {
      for (const chaosFunc of this.config.customChaos) {
        const result = await chaosFunc(req, res);
        if (result === false) {
          return;
        }
      }

      if (!this._shouldApplyChaos(req)) {
        return next();
      }

      await this._applyDelay();

      const selectedError = this._selectRandomError();

      this._log("info", "NaaS chaos applied", {
        path: req.path,
        method: req.method,
        errorCode: selectedError.code,
        errorMessage: selectedError.message,
      });

      Object.entries(this.config.customHeaders).forEach(([key, value]) => {
        res.set(key, value);
      });

      const errorResponse = this._formatErrorResponse(selectedError, req);

      if (this.config.responseFormat === "xml") {
        res.set("Content-Type", "application/xml");
      } else if (this.config.responseFormat === "plain") {
        res.set("Content-Type", "text/plain");
      } else {
        res.set("Content-Type", "application/json");
      }

      res.status(selectedError.code).send(errorResponse);
    } catch (error) {
      this._log("error", "NaaS middleware error", { error: error.message });
      next(error);
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this._validateConfig();
    this._normalizeErrorWeights();
  }

  getStats() {
    return {
      config: { ...this.config },
      environment: process.env.NODE_ENV || "development",
      version: "1.0.0",
    };
  }

  disable() {
    this._originalErrorRate = this.config.errorRate;
    this.config.errorRate = 0;
  }

  enable() {
    if (this._originalErrorRate !== undefined) {
      this.config.errorRate = this._originalErrorRate;
    }
  }
}

function createNaaS(options = {}) {
  const naas = new NaaS(options);
  return naas.middleware;
}

module.exports = {
  NaaS,
  createNaaS,
  default: createNaaS,
};
