const request = require("supertest");
const express = require("express");
const { NaaS, createNaaS } = require("../index");

describe("NaaS - No as a Service", () => {
  let app;

  beforeEach(() => {
    app = express();
  });

  describe("Configuration Validation", () => {
    test("should create NaaS with default configuration", () => {
      const naas = new NaaS();
      expect(naas.config.errorRate).toBe(10);
      expect(naas.config.errors).toHaveLength(7);
    });

    test("should accept custom configuration", () => {
      const naas = new NaaS({
        errorRate: 25,
        errors: [{ code: 500, message: "Test Error", weight: 100 }],
      });
      expect(naas.config.errorRate).toBe(25);
      expect(naas.config.errors).toHaveLength(1);
    });

    test("should throw error for invalid error rate", () => {
      expect(() => new NaaS({ errorRate: -1 })).toThrow(
        "Error rate must be between 0 and 100"
      );
      expect(() => new NaaS({ errorRate: 101 })).toThrow(
        "Error rate must be between 0 and 100"
      );
    });

    test("should throw error for invalid errors configuration", () => {
      expect(() => new NaaS({ errors: [] })).toThrow(
        "Errors configuration must be a non-empty array"
      );
      expect(() => new NaaS({ errors: [{ code: 500 }] })).toThrow(
        "Each error must have a code and message"
      );
    });
  });

  describe("Middleware Functionality", () => {
    test("should pass through requests when error rate is 0", async () => {
      app.use(createNaaS({ errorRate: 0 }));
      app.get("/test", (req, res) => res.json({ success: true }));

      const response = await request(app).get("/test");
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should always return errors when error rate is 100", async () => {
      app.use(
        createNaaS({
          errorRate: 100,
          errors: [{ code: 500, message: "Always fails", weight: 100 }],
        })
      );
      app.get("/test", (req, res) => res.json({ success: true }));

      const response = await request(app).get("/test");
      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe("Always fails");
      expect(response.body.error.chaos).toBe(true);
    });

    test("should respect target routes", async () => {
      const naas = createNaaS({
        errorRate: 100,
        targetRoutes: ["/chaos"],
        errors: [{ code: 500, message: "Chaos error", weight: 100 }],
      });

      app.use(naas);
      app.get("/chaos", (req, res) => res.json({ success: true }));
      app.get("/safe", (req, res) => res.json({ success: true }));

      const chaosResponse = await request(app).get("/chaos");
      expect(chaosResponse.status).toBe(500);

      const safeResponse = await request(app).get("/safe");
      expect(safeResponse.status).toBe(200);
    });

    test("should respect excluded routes", async () => {
      const naas = createNaaS({
        errorRate: 100,
        excludeRoutes: ["/safe"],
        errors: [{ code: 500, message: "Chaos error", weight: 100 }],
      });

      app.use(naas);
      app.get("/chaos", (req, res) => res.json({ success: true }));
      app.get("/safe", (req, res) => res.json({ success: true }));

      const chaosResponse = await request(app).get("/chaos");
      expect(chaosResponse.status).toBe(500);

      const safeResponse = await request(app).get("/safe");
      expect(safeResponse.status).toBe(200);
    });

    test("should respect target HTTP methods", async () => {
      const naas = createNaaS({
        errorRate: 100,
        targetMethods: ["POST"],
        errors: [{ code: 500, message: "Chaos error", weight: 100 }],
      });

      app.use(naas);
      app.get("/test", (req, res) => res.json({ success: true }));
      app.post("/test", (req, res) => res.json({ success: true }));

      const getResponse = await request(app).get("/test");
      expect(getResponse.status).toBe(200);

      const postResponse = await request(app).post("/test");
      expect(postResponse.status).toBe(500);
    });

    test("should add chaos headers to error responses", async () => {
      app.use(
        createNaaS({
          errorRate: 100,
          errors: [{ code: 500, message: "Test error", weight: 100 }],
          customHeaders: { "X-Test": "value" },
        })
      );
      app.get("/test", (req, res) => res.json({ success: true }));

      const response = await request(app).get("/test");
      expect(response.headers["x-chaos-engineering"]).toBe("NaaS");
      expect(response.headers["x-naas-version"]).toBe("1.0.0");
      expect(response.headers["x-test"]).toBe("value");
    });
  });

  describe("Response Formats", () => {
    test("should return JSON response by default", async () => {
      app.use(
        createNaaS({
          errorRate: 100,
          errors: [{ code: 500, message: "Test error", weight: 100 }],
        })
      );
      app.get("/test", (req, res) => res.json({ success: true }));

      const response = await request(app).get("/test");
      expect(response.type).toBe("application/json");
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe("Test error");
    });

    test("should return plain text when configured", async () => {
      app.use(
        createNaaS({
          errorRate: 100,
          responseFormat: "plain",
          errors: [{ code: 500, message: "Test error", weight: 100 }],
        })
      );
      app.get("/test", (req, res) => res.json({ success: true }));

      const response = await request(app).get("/test");
      expect(response.type).toBe("text/plain");
      expect(response.text).toBe("Test error");
    });

    test("should return XML when configured", async () => {
      app.use(
        createNaaS({
          errorRate: 100,
          responseFormat: "xml",
          errors: [{ code: 500, message: "Test error", weight: 100 }],
        })
      );
      app.get("/test", (req, res) => res.json({ success: true }));

      const response = await request(app).get("/test");
      expect(response.type).toBe("application/xml");
      expect(response.text).toContain("<code>500</code>");
      expect(response.text).toContain("<message>Test error</message>");
    });
  });

  describe("Custom Chaos Functions", () => {
    test("should execute custom chaos functions", async () => {
      let customExecuted = false;

      app.use(
        createNaaS({
          errorRate: 0, // Disable regular chaos
          customChaos: [
            async (req, res) => {
              customExecuted = true;
              res.status(418).json({ message: "Custom chaos" });
              return false; // Handled response
            },
          ],
        })
      );
      app.get("/test", (req, res) => res.json({ success: true }));

      const response = await request(app).get("/test");
      expect(response.status).toBe(418);
      expect(response.body.message).toBe("Custom chaos");
      expect(customExecuted).toBe(true);
    });
  });

  describe("Environment Handling", () => {
    test("should respect environment configuration", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      app.use(
        createNaaS({
          errorRate: 100,
          environments: ["development"], // Only apply in development
          errors: [{ code: 500, message: "Test error", weight: 100 }],
        })
      );
      app.get("/test", (req, res) => res.json({ success: true }));

      const response = await request(app).get("/test");
      expect(response.status).toBe(200); // Should pass through in production

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Runtime Configuration", () => {
    test("should allow configuration updates", () => {
      const naas = new NaaS({ errorRate: 10 });
      expect(naas.config.errorRate).toBe(10);

      naas.updateConfig({ errorRate: 25 });
      expect(naas.config.errorRate).toBe(25);
    });

    test("should allow enabling/disabling chaos", () => {
      const naas = new NaaS({ errorRate: 50 });
      expect(naas.config.errorRate).toBe(50);

      naas.disable();
      expect(naas.config.errorRate).toBe(0);

      naas.enable();
      expect(naas.config.errorRate).toBe(50);
    });

    test("should provide statistics", () => {
      const naas = new NaaS({ errorRate: 15 });
      const stats = naas.getStats();

      expect(stats.config.errorRate).toBe(15);
      expect(stats.version).toBe("1.0.0");
      expect(stats.environment).toBeDefined();
    });
  });

  describe("Error Weight Distribution", () => {
    test("should normalize error weights correctly", () => {
      const naas = new NaaS({
        errors: [
          { code: 500, message: "Error 1", weight: 50 },
          { code: 502, message: "Error 2", weight: 30 },
          { code: 503, message: "Error 3", weight: 20 },
        ],
      });

      const errors = naas.config.errors;
      expect(errors[0].normalizedWeight).toBeCloseTo(0.5);
      expect(errors[1].normalizedWeight).toBeCloseTo(0.3);
      expect(errors[2].normalizedWeight).toBeCloseTo(0.2);
    });
  });

  describe("Factory Function", () => {
    test("should create middleware using factory function", async () => {
      const middleware = createNaaS({
        errorRate: 100,
        errors: [{ code: 500, message: "Factory error", weight: 100 }],
      });

      app.use(middleware);
      app.get("/test", (req, res) => res.json({ success: true }));

      const response = await request(app).get("/test");
      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe("Factory error");
    });
  });
});
