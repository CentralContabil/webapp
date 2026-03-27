# webapp-02 — SPED EFD → XLSX

Pasta dedicada ao **desenvolvimento da ferramenta SPED → XLSX** na arquitetura multi-ferramentas.

## Mapa no ecossistema

| Pasta / projeto | Função |
|-----------------|--------|
| **[webapp-01](../webapp-01)** | Plataforma: API Fastify, frontend (hub + NFe), worker Node **NFe**, Redis, Docker Compose |
| **webapp-02** (esta pasta) | Código **SPED**: CLI Python, worker/container, testes — **sem** duplicar a API HTTP |
| **[Sped to XLSx v2](../Sped to XLSx v2)** (Desktop) | Origem da lógica Python (reader, parser, processor, XlsxWriter); referência para portar/empacotar aqui |

## Integração prevista

- A API em `webapp-01` expõe rotas `/api/v1/tools/sped/*` (fila `sped-convert`) quando o backend SPED estiver pronto.
- O worker SPED (Docker) será construído a partir do conteúdo desta pasta (ou copiando/adaptando módulos do projeto desktop).
- O frontend em `webapp-01` já aponta o card **SPED → XLSX** para `/tools/sped` (placeholder até a API existir).

## Próximos passos (implementação)

1. `requirements.txt` + estrutura `src/` ou `sped_worker/` com CLI headless.
2. Dockerfile `worker-sped` e serviço no `docker-compose` do webapp-01 (profile `sped`).
3. Contrato de job alinhado ao NFe (`jobId`, `inputPath`, `outputPath`, progresso BullMQ).
