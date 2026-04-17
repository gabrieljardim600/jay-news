# Jay News — Brand Scraper Worker

Worker Railway que processa jobs de deep scrape (engine='deep') criados pelo Jay News.
Usa Puppeteer pra capturar assets dinâmicos, computed CSS e screenshots fullPage.

## Variáveis de ambiente

```
SUPABASE_URL=https://upespttemhmrewszxjet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service_role, NÃO anon
ANTHROPIC_API_KEY=sk-ant-...
POLL_INTERVAL_MS=5000              # opcional, default 5s
MAX_CONCURRENT_JOBS=1               # opcional, default 1
```

## Deploy Railway

1. No Railway, criar service apontando pra este diretório (`worker/`)
2. Build: Dockerfile (Railway detecta automaticamente)
3. Sem porta exposta (é um worker, não serve HTTP)
4. Adicionar env vars acima
5. Deploy

## Fluxo

1. Poll `brand_scrapes` por `status='pending' AND engine='deep'`
2. Puppeteer: navega URLs → intercepta assets → extrai cores computadas → screenshot
3. Download + upload Storage `brand-assets/<scrape_id>/<type>/<file>`
4. Haiku classifica design system
5. Renderiza HTML preview
6. Update `brand_scrapes` status=completed

## Dev local

```bash
npm install
npm run dev
```
