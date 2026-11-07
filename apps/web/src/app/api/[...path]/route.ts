/** Local/staging demo proxy. The synthetic admin token never reaches the browser. */
type Context = { params: Promise<{ path: string[] }> };
const allowedRoles = new Set(["national", "planner", "pharmacist", "facility"]);

async function proxy(request: Request, context: Context): Promise<Response> {
  const environment = process.env.APP_ENV;
  const token = process.env.DEMO_API_TOKEN;
  const base = process.env.API_INTERNAL_URL;
  if (!token || !base || !["local", "staging"].includes(environment ?? "")) {
    return Response.json(
      { error: "Demo session unavailable" },
      { status: 503 },
    );
  }
  const { path } = await context.params;
  if (
    !path.length ||
    !["counties", "demo"].includes(path[0]) ||
    path.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
  ) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const role = request.headers.get("x-demo-role");
  if (role) {
    if (!allowedRoles.has(role))
      return Response.json({ error: "Invalid role" }, { status: 400 });
    let enabled = false;
    try {
      const capability = await fetch(`${base}/demo/capabilities`, {
        headers,
        cache: "no-store",
      });
      enabled =
        capability.ok && (await capability.json()).role_switcher === true;
    } catch {
      return Response.json({ error: "Demo API unavailable" }, { status: 502 });
    }
    if (!enabled) {
      return Response.json(
        { error: "Demo role switching unavailable" },
        { status: 403 },
      );
    }
    headers.set("X-Demo-Role", role);
  }
  for (const name of ["content-type", "idempotency-key"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const query = new URL(request.url).search;
  try {
    const upstream = await fetch(`${base}/${path.join("/")}${query}`, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "error",
    });
    const content = await upstream.text();
    if (content.includes(token)) throw new Error("Unsafe upstream response");
    return new Response(content, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Demo API unavailable" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
