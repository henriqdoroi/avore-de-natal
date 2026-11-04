const SHADOWPAY_BASE_URL = "https://shadowpay-backend.onrender.com/api/v1";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Método não permitido." });
  }

  const secret = process.env.SHADOWPAY_SECRET_KEY;
  if (!secret || !secret.startsWith("sk_live_")) {
    return res.status(500).json({ success: false, authenticated: false, message: "Configure SHADOWPAY_SECRET_KEY na Vercel." });
  }

  try {
    const response = await fetch(SHADOWPAY_BASE_URL + "/ping", {
      headers: { Authorization: "Bearer " + secret, Accept: "application/json" },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.ok && data.success ? 200 : 502).json({
      success: response.ok && data.success === true,
      authenticated: response.ok && data.authenticated === true,
      message: response.ok ? (data.message || "Resposta recebida da ShadowPay.") : "A ShadowPay recusou a autenticação ou está indisponível."
    });
  } catch (error) {
    console.error("ShadowPay ping error:", error);
    return res.status(502).json({ success: false, authenticated: false, message: "Não foi possível conectar à ShadowPay." });
  }
};
