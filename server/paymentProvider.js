function transactionId(prefix) {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

function allowMockPayments() {
  return process.env.ALLOW_MOCK_PAYMENTS === "true";
}

function mockPayment({ kind, amount, method, reference }) {
  const pending = kind === "withdraw" ? "Pending Approval" : "Pending";
  return {
    ok: true,
    provider: "mock",
    message: method === "card"
      ? "Mock card deposit recorded. Use Stripe Elements or Checkout for live card processing."
      : method === "paypal"
        ? "Mock PayPal request recorded. Connect PayPal checkout for live processing."
        : method?.includes("crypto")
          ? "Mock crypto request recorded. Connect Coinbase Commerce for live processing."
          : "Mock payment request recorded.",
    transaction: {
      id: transactionId(kind === "withdraw" ? "WDR" : "DEP"),
      title: kind === "withdraw" ? "Withdrawal request submitted" : "Deposit request submitted",
      note: `${method} ${reference ? `- ${reference}` : ""}`.trim(),
      amount: Number(amount || 0),
      method,
      status: pending,
      date: "Now"
    }
  };
}

function requireLiveProvider(message, mockArgs) {
  if (allowMockPayments()) return mockPayment(mockArgs);
  throw new Error(message);
}

async function createStripeCheckout({ amount, currency = "usd", baseUrl }) {
  if (!process.env.STRIPE_SECRET_KEY) return null;

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${baseUrl}/home`);
  body.set("cancel_url", `${baseUrl}/wallet`);
  body.set("line_items[0][price_data][currency]", currency.toLowerCase());
  body.set("line_items[0][price_data][product_data][name]", "FC MatchHub wallet deposit");
  body.set("line_items[0][price_data][unit_amount]", String(Math.round(Number(amount) * 100)));
  body.set("line_items[0][quantity]", "1");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || "Stripe checkout failed.");
  return payload;
}

async function createDeposit({ amount, method, reference, baseUrl, currency }) {
  if (method === "card") {
    const checkout = await createStripeCheckout({ amount, currency, baseUrl });
    if (checkout) {
      return {
        ok: true,
        provider: "stripe",
        checkoutUrl: checkout.url,
        transaction: {
          id: checkout.id,
          title: "Card deposit checkout created",
          note: "Stripe Checkout session",
          amount: Number(amount || 0),
          method,
          status: "Pending",
          date: "Now"
        }
      };
    }

    return requireLiveProvider(
      "Stripe is not configured. Add STRIPE_SECRET_KEY before accepting real card deposits.",
      { kind: "deposit", amount, method, reference }
    );
  }

  if (method === "paypal") {
    return requireLiveProvider(
      "PayPal checkout is not configured. Add PayPal live credentials and checkout order creation before accepting PayPal deposits.",
      { kind: "deposit", amount, method, reference }
    );
  }

  if (method === "coinbase-crypto" || method === "crypto-wallet" || method?.includes("crypto")) {
    return requireLiveProvider(
      "Coinbase Commerce is not configured. Add COINBASE_COMMERCE_API_KEY and charge creation before accepting crypto deposits.",
      { kind: "deposit", amount, method, reference }
    );
  }

  return requireLiveProvider(
    "This deposit method is not configured for live payments.",
    { kind: "deposit", amount, method, reference }
  );
}

async function createWithdrawal({ amount, method, reference }) {
  const labels = {
    paypal: "PayPal payouts",
    "bank-transfer": "bank payouts",
    "crypto-wallet": "crypto payouts"
  };
  return requireLiveProvider(
    `${labels[method] || "Withdrawals"} are not configured for live payouts yet. Add the provider payout integration before approving withdrawals.`,
    { kind: "withdraw", amount, method, reference }
  );
}

module.exports = {
  createDeposit,
  createWithdrawal
};
