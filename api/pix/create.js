const SHADOWPAY_BASE_URL = "https://shadowpay-backend.onrender.com/api/v1";
const PRODUCT_AMOUNT = Number(process.env.PIX_AMOUNT || "177.87");

function send(res, status, body) {
  return res.status(status).setHeader("Cache-Control", "no-store").json(body);
}

function digits(value) {
  return String(value || "").replace(/\\D/g, "");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { success: false, message: "Método não permitido." });
  }

  const secret = process.env.SHADOWPAY_SECRET_KEY;
  if (!secret || !secret.startsWith("sk_live_")) {
    return send(res, 500, { success: false, message: "A chave da ShadowPay não está configurada na Vercel." });
  }

  const body = req.body || {};
  const customer = body.customer || {};
  const shipping = body.shipping || {};
  const utm = body.utm || {};
  const customerName = String(customer.name || "").trim();
  const customerEmail = String(customer.email || "").trim();
  const customerCpfCnpj = digits(customer.document && customer.document.number);

  if (customerName.length < 3) {
    return send(res, 400, { success: false, field: "name", message: "Informe o nome completo." });
  }
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(customerEmail)) {
    return send(res, 400, { success: false, field: "email", message: "Informe um e-mail válido." });
  }
  if (customerCpfCnpj.length !== 11 && customerCpfCnpj.length !== 14) {
    return send(res, 400, { success: false, field: "document", message: "CPF/CNPJ inválido." });
  }

  if (!Number.isFinite(PRODUCT_AMOUNT) || PRODUCT_AMOUNT < 0.5) {
    return send(res, 500, { success: false, message: "Configure PIX_AMOUNT com um valor válido (mínimo R$ 0,50)." });
  }

  const externalReference = "ARB-" + require("crypto").randomUUID();
  const utmSource = String(utm.utm_source || utm.utmSource || "").slice(0, 200);

  const chargePayload = {
    amount: Number(PRODUCT_AMOUNT.toFixed(2)),
    customerName,
    customerEmail,
    customerCpfCnpj,
    description: "Pedido Árvore de Natal 2,10m AQUATTRO",
    externalReference,
    ...(utmSource ? { utmSource } : {}),
    ...(process.env.SHADOWPAY_PRODUCT_ID ? { productId: process.env.SHADOWPAY_PRODUCT_ID } : {})
  };

  try {
    const gatewayResponse = await fetch(SHADOWPAY_BASE_URL + "/pix/charges", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secret,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(chargePayload)
    });

    const result = await gatewayResponse.json().catch(() => ({}));
    if (!gatewayResponse.ok || result.success !== true || !result.data || !result.data.id) {
      const message = result.message || result.error || "A ShadowPay não conseguiu criar a cobrança PIX.";
      console.error("ShadowPay create charge failed:", gatewayResponse.status, result);
      return send(res, gatewayResponse.status >= 400 && gatewayResponse.status < 500 ? gatewayResponse.status : 502, {
        success: false,
        message: String(message).slice(0, 240)
      });
    }

    const charge = result.data;
    const amountInCents = Math.round(Number(charge.amount || chargePayload.amount) * 100);
    return send(res, 200, {
      success: true,
      transactionId: charge.id,
      copyPaste: charge.pix && charge.pix.copyPaste,
      qrCodeUrl: charge.pix && charge.pix.qrCodeUrl,
      expiresAt: charge.expiresAt,
      amount: amountInCents,
      status: charge.status
    });
  } catch (error) {
    console.error("ShadowPay create charge error:", error);
    return send(res, 502, { success: false, message: "Não foi possível conectar à ShadowPay. Tente novamente." });
  }
};
