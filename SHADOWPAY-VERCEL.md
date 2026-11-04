# Integração PIX ShadowPay (Vercel)

O checkout utiliza Vercel Serverless Functions em JavaScript:

- `POST /api/pix/create`: cria uma cobrança PIX na ShadowPay.
- `GET /api/pix/status?id=...`: consulta o status diretamente na ShadowPay.
- `GET /api/pix/ping`: verifica a autenticação da chave.

## Única variável de ambiente

Configure somente:

| Nome | Valor |
|---|---|
| `SHADOWPAY_SECRET_KEY` | Chave secreta `sk_live_...` |

A variável é lida exclusivamente no servidor. Nunca coloque a chave no HTML, no navegador ou em variáveis com prefixo público.

Configure-a nos ambientes em que pretende testar/publicar (Production, Preview e Development). A variável existente em Production pode ser mantida; não é necessário criar outras variáveis para preço, produto ou upsell.

## Produto e valor

- Produto: `arvore-natal-2-10m-aquattro`
- Valor fixo no servidor: **R$ 47,90**
- O navegador não escolhe nem pode alterar o valor cobrado.
- O servidor confere se o valor devolvido pela ShadowPay corresponde ao preço do checkout.

Se o preço exibido na página mudar, atualize também `PRODUCT_AMOUNT` em `api/pix/create.js`.

## Fluxo e segurança

- O servidor valida nome, e-mail e CPF/CNPJ.
- O checkout só exibe o pagamento quando a ShadowPay devolve um código Pix copia-e-cola válido.
- A confirmação é feita por consulta de status a cada 5 segundos; a documentação da API fornecida não descreve webhook.
- `approved` é convertido em `PAID`; `pending` em `PENDING`; `expired` em `CANCELLED`; `refunded` e `chargeback` em `REFUNDED`.
- Status desconhecidos e falhas de consulta não são tratados como pagamento aprovado.
- Não existe uma rota de upsell confirmada neste repositório. Por isso, o checkout não redireciona para uma página inventada após o pagamento.
