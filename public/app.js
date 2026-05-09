const PRICE = 0.85;

const state = {
  display: "0",
  prev: null,
  op: null,
  waiting: false,
  showPaywall: false,
  pendingResult: null,
  paid: false,
  totalSpent: 0,
  processing: false,
  calcCount: 0,
};

const displayEl = document.getElementById("display");
const expressionEl = document.getElementById("expression");
const spentEl = document.getElementById("spent");
const countEl = document.getElementById("count");
const buttonsEl = document.getElementById("buttons");
const paywallEl = document.getElementById("paywall");
const payExprEl = document.getElementById("paywall-expression");
const payBtn = document.getElementById("pay-btn");
const cancelBtn = document.getElementById("cancel-btn");
const payErrorEl = document.getElementById("pay-error");

function calc(a, b, op) {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "×") return a * b;
  if (op === "÷") return a / b;
  return b;
}

function formatCalcCount(n) {
  return `${n} calc${n !== 1 ? "s" : ""}`;
}

function setError(message) {
  if (!message) {
    payErrorEl.classList.add("hidden");
    payErrorEl.textContent = "";
    return;
  }
  payErrorEl.textContent = message;
  payErrorEl.classList.remove("hidden");
}

function render() {
  displayEl.textContent = state.display;
  displayEl.className = `text-right text-5xl font-light tabular-nums truncate mt-1 transition-colors ${
    state.paid ? "text-emerald-400" : "text-white"
  }`;

  expressionEl.textContent = state.prev !== null && state.op ? `${state.prev} ${state.op}` : "";
  spentEl.textContent = `$${state.totalSpent.toFixed(2)} spent`;
  countEl.textContent = formatCalcCount(state.calcCount);

  if (state.showPaywall) {
    payExprEl.innerHTML = `${state.prev} ${state.op} ${parseFloat(state.display)} = <span class="blur-sm select-none text-white">████</span>`;
    paywallEl.classList.remove("hidden");
  } else {
    paywallEl.classList.add("hidden");
  }

  payBtn.disabled = state.processing;
  cancelBtn.disabled = state.processing;
  payBtn.textContent = state.processing ? "Redirecting..." : "Pay $0.35";
}

function inputDigit(digit) {
  if (state.paid) {
    state.display = String(digit);
    state.paid = false;
    state.waiting = false;
    render();
    return;
  }

  if (state.waiting) {
    state.display = String(digit);
    state.waiting = false;
  } else {
    state.display = state.display === "0" ? String(digit) : state.display + digit;
  }

  render();
}

function inputDecimal() {
  if (state.waiting) {
    state.display = "0.";
    state.waiting = false;
    render();
    return;
  }

  if (!state.display.includes(".")) {
    state.display += ".";
    render();
  }
}

function clearCalc() {
  state.display = "0";
  state.prev = null;
  state.op = null;
  state.waiting = false;
  state.paid = false;
  render();
}

function performOp(nextOp) {
  const value = parseFloat(state.display);
  if (state.prev === null) {
    state.prev = value;
  } else if (state.op) {
    const result = calc(state.prev, value, state.op);
    state.prev = result;
    state.display = String(result);
  }
  state.waiting = true;
  state.op = nextOp;
  render();
}

function handleEquals() {
  if (state.op && state.prev !== null) {
    state.pendingResult = calc(state.prev, parseFloat(state.display), state.op);
    state.showPaywall = true;
    setError("");
    render();
  }
}

async function startStripeCheckout() {
  if (state.processing) return;
  state.processing = true;
  setError("");
  render();

  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expression: `${state.prev} ${state.op} ${parseFloat(state.display)}`,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.url) {
      throw new Error(data.error || "Failed to create checkout session.");
    }

    sessionStorage.setItem("calc_pending_result", String(state.pendingResult));
    window.location.href = data.url;
  } catch (error) {
    state.processing = false;
    setError(error.message || "Checkout failed.");
    render();
  }
}

async function applyPaidResultFromReturn() {
  const params = new URLSearchParams(window.location.search);
  const paid = params.get("paid");
  const sessionId = params.get("session_id");

  if (paid !== "1" || !sessionId) return;

  try {
    const response = await fetch(`/api/checkout-session-status?session_id=${encodeURIComponent(sessionId)}`);
    const data = await response.json();
    if (!response.ok || !data.paid) return;

    const pendingResult = sessionStorage.getItem("calc_pending_result");
    if (pendingResult === null) return;

    state.display = String(pendingResult);
    state.prev = null;
    state.op = null;
    state.waiting = true;
    state.showPaywall = false;
    state.processing = false;
    state.paid = true;
    state.totalSpent = +(state.totalSpent + PRICE).toFixed(2);
    state.calcCount += 1;
    sessionStorage.removeItem("calc_pending_result");
    window.history.replaceState({}, "", "/");
    render();
  } catch {
    // Keep calculator state unchanged if verification fails.
  }
}

const buttonSpecs = [
  { label: "AC", variant: "function", onClick: clearCalc },
  { label: "±", variant: "function", onClick: () => {} },
  { label: "%", variant: "function", onClick: () => {} },
  { label: "÷", variant: "operator", onClick: () => performOp("÷") },
  ...[7, 8, 9].map((d) => ({ label: String(d), onClick: () => inputDigit(d) })),
  { label: "×", variant: "operator", onClick: () => performOp("×") },
  ...[4, 5, 6].map((d) => ({ label: String(d), onClick: () => inputDigit(d) })),
  { label: "−", variant: "operator", onClick: () => performOp("-") },
  ...[1, 2, 3].map((d) => ({ label: String(d), onClick: () => inputDigit(d) })),
  { label: "+", variant: "operator", onClick: () => performOp("+") },
  { label: "0", wide: true, onClick: () => inputDigit(0) },
  { label: ".", onClick: inputDecimal },
  { label: "=", variant: "equals", onClick: handleEquals },
];

const variantClass = {
  default: "bg-zinc-800 hover:bg-zinc-700 text-white",
  operator: "bg-zinc-600 hover:bg-zinc-500 text-white",
  function: "bg-zinc-700 hover:bg-zinc-600 text-zinc-300",
  equals: "bg-white hover:bg-zinc-100 text-zinc-900 font-semibold",
};

for (const spec of buttonSpecs) {
  const button = document.createElement("button");
  const variant = spec.variant || "default";
  button.className = `${variantClass[variant]} ${spec.wide ? "col-span-2" : ""} h-14 rounded-2xl text-lg font-medium transition-all active:scale-95`;
  button.textContent = spec.label;
  button.addEventListener("click", spec.onClick);
  buttonsEl.appendChild(button);
}

payBtn.addEventListener("click", startStripeCheckout);
cancelBtn.addEventListener("click", () => {
  if (state.processing) return;
  state.showPaywall = false;
  render();
});

applyPaidResultFromReturn();
render();
