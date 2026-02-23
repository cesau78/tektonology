export interface Env {
  API_KEY: string;
  ATLAS_API_KEY: string;
  ATLAS_APP_ID: string;
}

const DB = "tektonology";

function atlasUrl(env: Env, action: string) {
  return `https://data.mongodb-api.com/app/${env.ATLAS_APP_ID}/endpoint/data/v1/action/${action}`;
}

function atlasHeaders(env: Env) {
  return {
    "Content-Type": "application/json",
    "api-key": env.ATLAS_API_KEY,
  };
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function authenticate(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization") ?? "";
  return auth === `Bearer ${env.API_KEY}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!authenticate(request, env)) return unauthorized();

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/spools") {
      return getSpools(env);
    }

    if (request.method === "POST" && url.pathname === "/api/usage") {
      return postUsage(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function getSpools(env: Env): Promise<Response> {
  const res = await fetch(atlasUrl(env, "find"), {
    method: "POST",
    headers: atlasHeaders(env),
    body: JSON.stringify({
      dataSource: "Cluster0",
      database: DB,
      collection: "spools",
      filter: {},
    }),
  });

  const data = await res.json() as { documents: unknown[] };
  return Response.json(data.documents);
}

async function postUsage(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    project: string;
    spoolId: number;
    usageG: number;
    loggedAt: string;
  };

  const { project, spoolId, usageG, loggedAt } = body;
  if (!project || !spoolId || !usageG || !loggedAt) {
    return new Response("Bad Request: missing fields", { status: 400 });
  }

  // Fetch spool to compute cost server-side
  const spoolRes = await fetch(atlasUrl(env, "findOne"), {
    method: "POST",
    headers: atlasHeaders(env),
    body: JSON.stringify({
      dataSource: "Cluster0",
      database: DB,
      collection: "spools",
      filter: { spoolId },
    }),
  });

  const spoolData = await spoolRes.json() as { document: { cost: number; weightG: number } | null };
  if (!spoolData.document) {
    return new Response(`Spool ${spoolId} not found`, { status: 404 });
  }

  const { cost: spoolCost, weightG } = spoolData.document;
  const costPerGram = spoolCost / weightG;
  const cost = Math.round(usageG * costPerGram * 100) / 100;

  const insertRes = await fetch(atlasUrl(env, "insertOne"), {
    method: "POST",
    headers: atlasHeaders(env),
    body: JSON.stringify({
      dataSource: "Cluster0",
      database: DB,
      collection: "print_jobs",
      document: { project, spoolId, usageG, cost, loggedAt },
    }),
  });

  if (!insertRes.ok) {
    const err = await insertRes.text();
    return new Response(`Atlas error: ${err}`, { status: 502 });
  }

  return Response.json({ ok: true, cost });
}
