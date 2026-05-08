# CalcPay + Stripe (No npm required)

This project is a dependency-free web app:
- Frontend: static HTML/JS calculator UI in `public/`
- Backend: Node HTTP server in `server.js`
- Payments: Stripe Checkout via Stripe REST API

## 1) Configure environment

Copy `.env.example` to `.env` and set your Stripe secret key:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
PORT=3000
```

## 2) Run

Use Node 18+ and run:

```bash
set -a; source .env; set +a
node server.js
```

Open: [http://localhost:3000](http://localhost:3000)

## 3) How payment unlock works

1. User presses `=` and sees paywall.
2. `Pay $0.35` calls `/api/create-checkout-session`.
3. User completes payment on Stripe Checkout.
4. Stripe redirects back with `session_id`.
5. Frontend verifies payment through `/api/checkout-session-status`.
6. Calculator reveals result and updates spend/calc count.

## Notes

- Amount is hardcoded to `$0.35` in backend + UI.
- `±` and `%` buttons are placeholders (same as original snippet).
