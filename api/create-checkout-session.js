const PRICE_CENTS = 85;
const CURRENCY = "usd";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });
  }

  try {
    const origin = req.headers.origin || `https://${req.headers.host}`;

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
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const session = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: session?.error?.message || "Stripe session creation failed" });
    }

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};
