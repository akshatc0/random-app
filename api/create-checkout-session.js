const DEFAULT_PRICE_CENTS = 99;
const CURRENCY = "usd";
const MIN_PRICE_CENTS = 99;
const MAX_PRICE_CENTS = 9999;

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
    const bodyInput = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const amountCents = Number.isInteger(bodyInput.amount_cents) ? bodyInput.amount_cents : DEFAULT_PRICE_CENTS;
    const safeAmountCents = Math.min(MAX_PRICE_CENTS, Math.max(MIN_PRICE_CENTS, amountCents));
    const itemName = typeof bodyInput.item_name === "string" && bodyInput.item_name.trim()
      ? bodyInput.item_name.trim().slice(0, 120)
      : "Information reveal";

    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("success_url", `${origin}/?paid=1&session_id={CHECKOUT_SESSION_ID}`);
    body.set("cancel_url", `${origin}/?canceled=1`);
    body.set("line_items[0][price_data][currency]", CURRENCY);
    body.set("line_items[0][price_data][product_data][name]", itemName);
    body.set("line_items[0][price_data][unit_amount]", String(safeAmountCents));
    body.set("line_items[0][quantity]", "1");
    body.set("allow_promotion_codes", "true");

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
