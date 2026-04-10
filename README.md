# 🚀 Nexus Engine API

Bem-vindo à documentação oficial da **Nexus Engine API**. Esta é uma API de alta performance focada na extração (web scraping) de dados financeiros de ativos da B3 (Ações, FIIs, BDRs, ETFs). 

A API foi construída para resolver os gargalos dos scrapers tradicionais (como Cheerio e Puppeteer), utilizando uma arquitetura inovadora de **SAX Streaming (Zero-AST)**, que permite processar o HTML em tempo real sem carregar a árvore DOM inteira na memória.

---

## 🌟 Principais Recursos

- **SAX Streaming (Zero-AST)**: Processamento de HTML sob demanda, reduzindo drasticamente o uso de CPU e Memória.
- **Early Abort**: Interrompe o download do HTML assim que os dados necessários são encontrados, economizando banda.
- **Cache SWR (Stale-While-Revalidate)**: Respostas instantâneas servindo dados em cache enquanto revalida em background.
- **Circuit Breakers**: Proteção contra falhas em fontes externas (ex: Investidor10, StatusInvest).
- **Orquestração Paralela**: Busca simultânea de múltiplos ativos com controle de concorrência.

---

## 🛠️ Tecnologias Utilizadas

- **Node.js / Express**: Servidor web rápido e minimalista.
- **TypeScript**: Tipagem estática para maior segurança e manutenibilidade.
- **Zod**: Validação rigorosa de schemas de dados extraídos.

---

## 📡 Endpoints da API

Abaixo estão detalhados todos os endpoints disponíveis na API.

### 1. Health Check
Verifica se a API está online e respondendo.

- **URL**: `/api/health`
- **Método**: `GET`
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-04-09T16:45:00.000Z"
  }
  ```

---

### 2. Status do Motor (Stats)
Retorna as métricas atuais do motor Nexus, incluindo uso de cache, requisições em voo e estado dos Circuit Breakers.

- **URL**: `/api/stats`
- **Método**: `GET`
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "cache": {
      "tamanho": 42,
      "tamanhoMax": 300
    },
    "inFlightRequests": 2,
    "urlInFlightRequests": 0,
    "circuitBreakers": {
      "investidor10": "FECHADO",
      "statusinvest": "FECHADO"
    }
  }
  ```

---

### 3. Limpar Cache
Força a limpeza do cache LRU interno do motor. Útil para forçar a busca de dados frescos.

- **URL**: `/api/clear-cache`
- **Método**: `POST`
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

---

### 4. Extração Padrão (Scrape)
Realiza a extração de dados para uma lista de ativos.

- **URL**: `/api/scrape`
- **Método**: `POST`
- **Body (JSON)**:
  ```json
  {
    "tickers": ["PETR4", "VALE3"],
    "type": "ACAO",
    "includeNews": false
  }
  ```
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "results": [
      {
        "ticker": "PETR4",
        "results": {
          "precoAtual": 38.50,
          "dividendYield": "15.2%",
          "pl": 4.5,
          "pvp": 1.1
        },
        "cacheStatus": "MISS",
        "metrics": {
          "totalTimeMs": 120,
          "bytesProcessed": 15000,
          "successRate": 1,
          "source": "Nexus Engine Ultra"
        }
      }
    ]
  }
  ```

---

### 5. Extração Avançada (Scrape V2)
Semelhante ao `/api/scrape`, mas inclui um relatório detalhado de análise da execução, ideal para dashboards e monitoramento de performance.

- **URL**: `/api/scrape-v2`
- **Método**: `POST`
- **Body (JSON)**:
  ```json
  {
    "tickers": ["ITUB4"],
    "type": "ACAO"
  }
  ```
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "results": [ /* ... array de resultados dos ativos ... */ ],
    "analysis": {
      "durationMs": 150.5,
      "successRate": 100,
      "totalBytes": 15000,
      "avgTimePerTicker": 150.5,
      "engineVersion": "10.1-Ultra",
      "report": {
        "capabilities": ["SAX Streaming (Zero-AST)", "Early Abort", "Orquestração Paralela", "SWR Cache", "Circuit Breakers"],
        "metrics": {
          "circuitBreakers": {
            "investidor10": "FECHADO",
            "statusinvest": "FECHADO"
          }
        }
      }
    }
  }
  ```

---

### 6. Benchmark & Comparação
Executa uma "corrida" comparando a performance do Nexus Engine contra o scraper legado (baseado em Cheerio) e, opcionalmente, contra um endpoint customizado.

- **URL**: `/api/benchmark-compare`
- **Método**: `POST`
- **Body (JSON)**:
  ```json
  {
    "tickers": ["BBDC4", "ABEV3", "WEGE3"],
    "customEndpoint": "https://sua-api.com/ativos/{{ticker}}" // Opcional
  }
  ```
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "legacy": {
      "time": 4500.2,
      "results": [ /* ... resultados do scraper legado ... */ ]
    },
    "nexus": {
      "time": 350.8,
      "results": [ /* ... resultados do Nexus Engine ... */ ]
    },
    "customEndpoint": null
  }
  ```

---

## 🚀 Como Executar o Projeto

1. **Instalar Dependências**:
   ```bash
   npm install
   ```

2. **Rodar em Desenvolvimento**:
   ```bash
   npm run dev
   ```
   O servidor iniciará na porta `3000` (ou a porta definida no ambiente) e o frontend Vite estará disponível.

3. **Build para Produção**:
   ```bash
   npm run build
   ```

4. **Iniciar em Produção**:
   ```bash
   npm start
   ```

---

## 🛡️ Tratamento de Erros

A API retorna códigos de status HTTP padrão para indicar sucesso ou falha:
- `200 OK`: Requisição bem-sucedida.
- `400 Bad Request`: Parâmetros ausentes ou inválidos no corpo da requisição (ex: `tickers` não é um array).
- `404 Not Found`: Rota não encontrada. Retorna uma lista de rotas disponíveis.
- `500 Internal Server Error`: Erro interno no servidor ou falha crítica no motor de extração.

Erros geralmente seguem o formato:
```json
{
  "error": "Mensagem descritiva do erro"
}
```
