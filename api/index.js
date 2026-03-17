import "../services/shared/env.js";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import { createRoutes } from "./routes.js";
import { jwtCheck } from "./auth.js";

const port = process.env.API_PORT ?? 3001;
const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/tektonology";
const dbName = process.env.DB_NAME ?? "tektonology";

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

console.log(`Connected to MongoDB: ${dbName}`);

const app = express();
app.use(cors({ origin: /localhost/ }));
app.use(express.json());
app.use(jwtCheck);

createRoutes(app, db);

app.listen(port, () => {
  console.log(`tektonology-api listening on http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  await client.close();
  process.exit(0);
});
