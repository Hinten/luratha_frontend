# Integração Melhor Envio — como obter o `MELHOR_ENVIO_TOKEN`

Este documento explica como gerar as credenciais que a integração de frete do
Luratha precisa. O cálculo de frete vive em `src/lib/shipping/` e o adapter do
Melhor Envio (`src/lib/shipping/melhorEnvio/`) autentica com um **token Bearer**
estático lido de variável de ambiente.

## Variáveis de ambiente

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `MELHOR_ENVIO_TOKEN` | sim | — | Token de API (Bearer) gerado no painel do Melhor Envio. |
| `MELHOR_ENVIO_ENV` | não | `sandbox` | `sandbox` ou `production`. Define a base URL da API. |
| `MELHOR_ENVIO_USER_AGENT` | não | `Luratha (contato@luratha.com.br)` | Header `User-Agent` exigido pela API do Melhor Envio (eles pedem identificação + e-mail de contato). |

Base URLs (definidas em `src/lib/shipping/melhorEnvio/client.ts`):

- `sandbox` → `https://sandbox.melhorenvio.com.br`
- `production` → `https://www.melhorenvio.com.br`

> **Importante:** o token é vinculado ao ambiente. Um token gerado no sandbox
> **não** funciona em produção e vice-versa. Mantenha dois tokens distintos.

## Caminho recomendado — Token pessoal de API (loja única)

O Luratha é uma loja única (não é marketplace), então o caminho mais simples é
gerar um **token pessoal** direto no painel. Não precisa do fluxo OAuth completo.

### 1. Crie as contas

- **Sandbox (testes):** crie uma conta em <https://sandbox.melhorenvio.com.br>.
  O ambiente é isolado — pedidos e etiquetas são fictícios, nada é cobrado.
- **Produção:** crie/usar a conta real em <https://melhorenvio.com.br>.

### 2. Gere o token no painel

1. Faça login no painel do ambiente desejado (sandbox **ou** produção).
2. Acesse **Configurações → Integrações** (ou **Gerenciar → Tokens**, o rótulo
   varia conforme a versão do painel).
3. Clique em **Criar/Gerar token**.
4. Dê um nome identificável (ex.: `luratha-frontend-sandbox`).
5. Selecione os **escopos (permissions)** necessários:
   - `shipping-calculate` — **obrigatório** (cálculo de frete `POST /api/v2/me/shipment/calculate`).
   - `shipping-tracking` — necessário para o rastreamento ativo (issue #80 PR 2).
   - `shipping-services` — opcional, para listar serviços/transportadoras disponíveis.
   - Os escopos de `cart`, `orders`, `users` **não** são usados pelo Luratha hoje.
6. Confirme. O painel exibe o token **uma única vez** — copie imediatamente.

O token é um JWT longo (centenas de caracteres) e tem validade longa. Se ele
expirar ou for revogado, repita este passo e atualize a variável de ambiente.

### 3. Configure as variáveis

Crie um arquivo `.env.local` na raiz do projeto (não versionado) a partir do
`.env.example`:

```bash
cp .env.example .env.local
```

Preencha o bloco do Melhor Envio:

```bash
# Desenvolvimento / testes
MELHOR_ENVIO_TOKEN="<token-gerado-no-sandbox>"
MELHOR_ENVIO_ENV="sandbox"
MELHOR_ENVIO_USER_AGENT="Luratha (seu-email@exemplo.com)"
```

Em produção (Firebase App Hosting), configure as mesmas variáveis como
**secrets/variáveis de ambiente do backend** — nunca commite o token.

### 4. Valide

Com o servidor rodando (`npm run dev`), chame o endpoint de frete:

```bash
curl -X POST http://localhost:3000/api/checkout/shipping \
  -H "Content-Type: application/json" \
  -d '{
    "postalCode": "01310-100",
    "items": [
      { "productId": "teste", "quantity": 1, "unitPrice": 100, "weightKg": 0.5 }
    ]
  }'
```

Resposta esperada: um objeto com `quotes` (lista de opções de frete),
`freeShippingThreshold` e `referenceShippingCost`. Se vier
`{ "code": "config_missing" }`, o token não foi lido — confira o `.env.local`
e reinicie o `npm run dev`.

> **Fallback `fixed-rate`:** por padrão (`siteSettings.shipping.fixedRate.enabledAsFallback`
> = `false`), quando o Melhor Envio está indisponível ou sem token, o cálculo
> de frete retorna **HTTP 502** e bloqueia o checkout — postura segura, evita
> cotar por uma tabela fixa que pode dar prejuízo. Para ligar o fallback
> automático, defina `enabledAsFallback: true`; aí uma falha do Melhor Envio
> cai na tabela `siteSettings.shipping.fixedRate` e responde com
> `usedFallback: true`. Se o próprio fallback também estiver indisponível
> (sem `defaultEntry`/`entries` para a UF), o erro retornado cita as duas falhas.

## Caminho alternativo — OAuth2 (marketplace / multi-loja)

Se um dia o Luratha precisar emitir fretes em nome de **outras** contas (cenário
de marketplace), o token pessoal não basta — é preciso registrar uma aplicação
OAuth2:

1. Painel → **Configurações → Aplicativos → Criar aplicativo**.
2. Defina `redirect_uri`, escopos e obtenha `client_id` + `client_secret`.
3. Implemente o fluxo Authorization Code: redirecionar o lojista para
   `/oauth/authorize`, trocar o `code` por `access_token` + `refresh_token` em
   `/oauth/token`, e renovar o `access_token` quando expirar.

Isso exigiria mudar o `resolveConfig()` em
`src/lib/shipping/melhorEnvio/client.ts` para buscar um token dinâmico (por
loja) em vez do `MELHOR_ENVIO_TOKEN` fixo. **Fora do escopo atual** — a
arquitetura `ShippingProvider` permite essa evolução sem afetar o resto do app.

## Referências

- Documentação oficial da API: <https://docs.melhorenvio.com.br>
- Sandbox: <https://sandbox.melhorenvio.com.br>
- Plano de checkout: `plan/checkout-flow-roadmap.md`
- Implementação: `src/lib/shipping/melhorEnvio/`
