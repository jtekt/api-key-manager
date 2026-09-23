import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth.js";
import keysRouter from "./routes/keys.js";
import validateRouter from "./routes/validate.js";

const { APP_VERSION = "dev" } = process.env;

console.log(`API key manager ${APP_VERSION}`);

const app = new Hono();
app.use(cors());
app.get("/", (c) =>
  c.json({ application_name: "api-key-manager", version: APP_VERSION }),
);
app.use("/keys/*", authMiddleware);
app.route("/keys", keysRouter);
app.route("/validate", validateRouter);

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, (info) => {
  console.log(`Server running on port ${info.port}`);
});
