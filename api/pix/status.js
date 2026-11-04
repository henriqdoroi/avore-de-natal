const SHADOWPAY_BASE_URL = "https://shadowpay-backend.onrender.com/api/v1";

function send(res, status, body) {
  return res.status(status).setHeader("Cache-Control", "no-store").json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { status: "ERROR", message: "Método não permitido." });
  }

  const secret = process.env.SHADOWPAY_SECRET_KEY;
  if (!secret || !secret.startsWith("sk_live_")) {
    return send(res, 500, { status: "ERROR", message: "A chave da ShadowPay não está configurada neste ambiente." });
  }

  const id = String(req.query && req.query.id || "").trim();
  if (!/^[a-zA-Z0-9_-]{6,128}$/.test(id)) {
    return send(res, 400, { status: "ERROR", message: "ID de cobrança inválido." });
  }

  try {
    const gatewayResponse = await fetch(SHADOWPAY_BASE_URL + "/pix/charges/" + encodeURIComponent(id), {
      method: "GET",
      headers: {
        Authorization: "Bearer " + secret,
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const result = await gatewayResponse.json().catch(() => ({}));
    if (!gatewayResponse.ok || result.success !== true || !result.data) {
      console.error("ShadowPay status lookup failed:", gatewayResponse.status);
      return send(res, gatewayResponse.status >= 400 && gatewayResponse.status < 500 ? gatewayResponse.status : 502, {
        status: "ERROR",
        message: "Não foi possível consultar o pagamento. A verificação será tentada novamente."
      });
    }

    const originalStatus = String(result.data.status || "").toLowerCase();
    const statusMap = {
      pending: "PENDING",
      approved: "PAID",
      expired: "CANCELLED",
      refunded: "REFUNDED",
      chargeback: "REFUNDED"
    };
    const mappedStatus = statusMap[originalStatus];
    if (!mappedStatus) {
      console.error("ShadowPay returned an unknown charge status:", originalStatus || "(empty)");
      return send(res, 502, { status: "ERROR", message: "A ShadowPay retornou um status de pagamento desconhecido." });
    }

    return send(res, 200, { status: mappedStatus });
  } catch (error) {
    console.error("ShadowPay status network error:", error && error.name);
    return send(res, 502, { status: "ERROR", message: "Falha ao consultar o pagamento." });
  }
};
