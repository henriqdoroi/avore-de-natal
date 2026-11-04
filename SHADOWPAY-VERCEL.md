# Integração PIX ShadowPay (Vercel)

O checkout usa Vercel Serverless Functions em JavaScript:

- `POST /api/pix/create`: cria cobrança em `POST https://shadowpay-backend.onrender.com/api/v1/pix/charges`.
- `GET /api/pix/status?id=...`: consulta `GET /api/v1/pix/charges/{id}`.
- `GET /api/pix/ping`: testa a autenticação em `GET https://shadowpay-backend.onrender.com/api/v1/ping`.

## Variáveis de ambiente da Vercel

Configure em **Project → Settings → Environment Variables**:

| Nome | Valor |
|---|---|
| `SHADOWPAY_SECRET_KEY` | Sua chave secreta `sk_live_...` |
| `PIX_AMOUNT` | `177.87` (valor em reais; ajuste se o preço do produto mudar) |
| `SHADOWPAY_PRODUCT_ID` | Opcional: ID do produto cadastrado na ShadowPay |
| `PIX_UPSELL_URL` | Opcional: URL HTTPS do upsell, aberta somente após status `approved` |

Depois de salvar as variáveis, faça um novo deploy para aplicá-las.

## Observações

- A chave secreta só é lida no servidor. Não use prefixo `NEXT_PUBLIC_` nem a coloque no HTML.
- O valor da cobrança é definido no servidor por `PIX_AMOUNT`, não pelo navegador.
- O backend traduz `approved` para `PAID`, `pending` para `PENDING`, `expired`/`chargeback` para `CANCELLED` e `refunded` para `REFUNDED`.
- A página de pagamento mostra o QR Code e o código copia-e-cola devolvidos pela ShadowPay.
- A documentação fornecida não descreve webhook; a confirmação da tela é feita por consulta de status a cada 5 segundos.
