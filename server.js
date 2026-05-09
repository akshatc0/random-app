const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const PRICE_CENTS = 85;
const CURRENCY = "usd";

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function serveStatic(res, filePath, contentType) {
  try {
    const fullPath = path.join(__dirname, "public", filePath);
    const data = fs.readFileSync(fullPath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function createCheckoutSession(origin) {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${origin}/?paid=1&session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${origin}/?canceled=1`);
  body.set("line_items[0][price_data][currency]", CURRENCY);
  body.set("line_items[0][price_data][product_data][name]", "Calculation result");
  body.set("line_items[0][price_data][unit_amount]", String(PRICE_CENTS));
  body.set("line_items[0][quantity]", "1");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const session = await response.json();
  if (!response.ok) {
    throw new Error(session?.error?.message || "Stripe session creation failed");
  }
  return session;
}

async function getCheckoutSessionStatus(sessionId) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    },
  });

  const session = await response.json();
  if (!response.ok) {
    throw new Error(session?.error?.message || "Failed to load Stripe session");
  }
  return session.payment_status;
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && reqUrl.pathname === "/") {
      serveStatic(res, "index.html", "text/html; charset=utf-8");
      return;
    }

    if (req.method === "GET" && reqUrl.pathname === "/app.js") {
      serveStatic(res, "app.js", "application/javascript; charset=utf-8");
      return;
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/create-checkout-session") {
      if (!STRIPE_SECRET_KEY) {
        sendJson(res, 500, { error: "Missing STRIPE_SECRET_KEY in environment." });
        return;
      }

      await readBody(req);
      const origin = `http://${req.headers.host}`;
      const session = await createCheckoutSession(origin);
      sendJson(res, 200, { url: session.url, id: session.id });
      return;
    }

    if (req.method === "GET" && reqUrl.pathname === "/api/checkout-session-status") {
      if (!STRIPE_SECRET_KEY) {
        sendJson(res, 500, { error: "Missing STRIPE_SECRET_KEY in environment." });
        return;
      }

      const sessionId = reqUrl.searchParams.get("session_id");
      if (!sessionId) {
        sendJson(res, 400, { error: "Missing session_id query parameter." });
        return;
      }

      const paymentStatus = await getCheckoutSessionStatus(sessionId);
      sendJson(res, 200, { paid: paymentStatus === "paid" });
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`CalcPay server running at http://localhost:${PORT}`);
});
