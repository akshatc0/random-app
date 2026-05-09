module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });
  }

  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: "Missing session_id" });
  }

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${stripeKey}`,
      },
    });

    const session = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: session?.error?.message || "Failed to load Stripe session" });
    }

    return res.status(200).json({ paid: session.payment_status === "paid" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}; 
