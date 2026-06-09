import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { Params } from "nestjs-pino";

const isProd = process.env.NODE_ENV === "production";

export const loggerOptions: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? "info",
    transport: isProd
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            singleLine: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
    redact: {
      paths: [
        "req.headers.cookie",
        "req.headers.authorization",
        'req.headers["set-cookie"]',
        'res.headers["set-cookie"]',
      ],
      censor: "[Redacted]",
    },
    autoLogging: true,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    genReqId: (req, res) => {
      const inbound = req.headers["x-request-id"];
      const id =
        (Array.isArray(inbound) ? inbound[0] : inbound) ?? randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
  },
};
