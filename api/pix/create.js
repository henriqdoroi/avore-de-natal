const SHADOWPAY_BASE_URL = "https://shadowpay-backend.onrender.com/api/v1";
const PRODUCT_AMOUNT = 177.87;
const PRODUCT_ID = "arvore-natal-2-10m-aquattro";

function send(res, status, body) {
  return res.status(status).setHeader("Cache-Control", "no-store").json(body);
}

function digits(value) {
  return String(value || "").replace(/\\D/g, "");
}

function validCpf(value) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\\d)\\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

function validCnpj(value) {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || /^(\\d)\\1{13}$/.test(cnpj)) return false;
  const calc = (base, weights) => {
    const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calc(cnpj.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const second = calc(cnpj.slice(0, 12) + first, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { success: false, message: "Método não permitido." });
  }

  const secret = process.env.SHADOWPAY_SECRET_KEY;
  if (!secret || !secret.startsWith("sk_live_")) {
    return send(res, 500, { success: false, message: "A chave da ShadowPay não está configurada neste ambiente." });
  }

  const body = req.body || {};
  const customer = body.customer || {};
  const documentNumber = digits(customer.document && customer.document.number);
  const customerName = String(customer.name || "").trim();
  const customerEmail = String(customer.email || "").trim();

  if (customerName.length < 3) {
    return send(res, 400, { success: false, field: "name", message: "Informe o nome completo." });
  }
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(customerEmail)) {
    return send(res, 400, { success: false, field: "email", message: "Informe um e-mail válido." });
  }
  if (!(documentNumber.length === 11 ? validCpf(documentNumber) : validCnpj(documentNumber))) {
    return send(res, 400, { success: false, field: "document", message: "Informe um CPF ou CNPJ válido." });
  }

  if (!Number.isFinite(PRODUCT_AMOUNT) || PRODUCT_AMOUNT < 0.5) {
    return send(res, 500, { success: false, message: "O valor fixo do produto está inválido." });
  }

  const utm = body.utm || {};
  const utmSource = String(utm.utm_source || utm.utmSource || "").slice(0, 200);
  const chargePayload = {
    amount: Number(PRODUCT_AMOUNT.toFixed(2)),
    customerName,
    customerEmail,
    customerCpfCnpj: documentNumber,
    description: "Pedido Árvore de Natal 2,10m AQUATTRO",
    externalReference: "ARB-" + require("crypto").randomUUID(),
    ...(utmSource ? { utmSource } : {}),
    productId: PRODUCT_ID
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
      console.error("ShadowPay create charge failed:", gatewayResponse.status, {
        success: result.success === true,
        hasMessage: Boolean(result.message || result.error)
      });
      const message = result.message || result.error || "A ShadowPay não conseguiu criar a cobrança PIX.";
      return send(res, gatewayResponse.status >= 400 && gatewayResponse.status < 500 ? gatewayResponse.status : 502, {
        success: false,
        message: String(message).slice(0, 200)
      });
    }

    const charge = result.data;
    const copyPaste = charge.pix && charge.pix.copyPaste;
    const amount = Number(charge.amount);
    if (typeof copyPaste !== "string" || !copyPaste.trim()) {
      console.error("ShadowPay returned a charge without Pix copyPaste.");
      return send(res, 502, { success: false, message: "A ShadowPay criou a cobrança, mas não retornou o código Pix. Entre em contato com o suporte." });
    }
    if (!Number.isFinite(amount) || Math.abs(amount - PRODUCT_AMOUNT) > 0.01) {
      console.error("ShadowPay returned an unexpected charge amount.");
      return send(res, 502, { success: false, message: "O valor retornado pela ShadowPay não corresponde ao total do pedido." });
    }

    return send(res, 200, {
      success: true,
      transactionId: String(charge.id),
      copyPaste: copyPaste.trim(),
      qrCodeUrl: charge.pix.qrCodeUrl || null,
      expiresAt: charge.expiresAt || null,
      amount: Math.round(amount * 100),
      status: String(charge.status || "pending").toLowerCase()
    });
  } catch (error) {
    console.error("ShadowPay create charge network error:", error && error.name);
    return send(res, 502, { success: false, message: "Não foi possível conectar à ShadowPay. Tente novamente." });
  }
};
