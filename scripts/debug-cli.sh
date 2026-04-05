#!/bin/bash
# Script CLI per test/debug rapido di Claude Code Mobile.
# Lancia un Claude Code in background e simula una sessione WS per testare il parser/output.
#
# Requisiti: claude CLI installato, modello qwen/qwen3.6-plus:free configurato
#
# Usage: ./scripts/debug-cli.sh [COMMAND]
#   start        - Avvia container
#   test         - Test rapido connessione backend
#   logs         - Segui i log del backend
#   stop         - Ferma container
#   shell        - Entra nel container backend

set -e
cd "$(dirname "$0")/.."

MODEL="qwen/qwen3.6-plus:free"

case "${1:-help}" in
  start)
    echo "Avvio claude-code-mobile con modello: $MODEL..."
    AUTH_TOKEN="${AUTH_TOKEN:-debug-token}" docker compose up -d --build
    echo "Backend: http://localhost:4000"
    echo "Token: $AUTH_TOKEN"
    ;;
  test)
    echo "Test connessioni..."
    echo -n "  Health: "
    curl -s http://localhost:4000/health
    echo ""
    echo -n "  Auth: "
    curl -s http://localhost:4000/api/auth -H "Authorization: Bearer debug-token"
    echo ""
    echo -n "  Sessioni: "
    curl -s http://localhost:4000/api/sessions -H "Authorization: Bearer debug-token"
    echo ""
    echo "OK"
    ;;
  logs)
    docker compose logs -f --tail=100
    ;;
  stop)
    docker compose down
    echo "Container fermato."
    ;;
  shell)
    docker compose exec backend /bin/sh 2>/dev/null || docker exec -it claude-code-mobile-backend /bin/sh
    ;;
  *)
    echo "Usage: $0 {start|test|logs|stop|shell}"
    exit 1
    ;;
esac
