# Trading Integration Plan for AI Builder v2

## Overview
Integrate Alpaca, Finnhub, and Tavily APIs to enable AI-assisted trading research and execution within AI Builder. The system uses local Ollama models for analysis (free) with optional cloud model escalation for complex tasks.

---

## Architecture: 5-Brain System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Trading Tab  │  │  Watchlist   │  │   Orders     │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR (Brain 0)                           │
│  Routes requests to appropriate brain, aggregates results               │
│  Model: qwen2.5:14b or user-selected                                    │
└─────────────────────────────────────────────────────────────────────────┘
        │              │              │              │              │
        ▼              ▼              ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│  Brain 1  │  │  Brain 2  │  │  Brain 3  │  │  Brain 4  │  │  Brain 5  │
│  MARKET   │  │   NEWS    │  │ SENTIMENT │  │ TECHNICAL │  │  RISK     │
│   DATA    │  │  SEARCH   │  │  ANALYST  │  │  ANALYST  │  │  MANAGER  │
│           │  │           │  │           │  │           │  │           │
│  Alpaca   │  │  Tavily   │  │  Finnhub  │  │  Ollama   │  │  Ollama   │
│  Finnhub  │  │  Finnhub  │  │  Ollama   │  │  Only     │  │  Alpaca   │
└───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘
```

---

## Phase 1: Backend API Routes

### 1.1 Alpaca Routes (`app/api/trading/alpaca/`)

```
app/api/trading/alpaca/
├── account/route.ts      GET    - Account info, buying power, equity
├── positions/route.ts    GET    - Current positions
├── orders/route.ts       GET    - List orders
│                         POST   - Place order
│                         DELETE - Cancel order
├── quotes/route.ts       GET    - Real-time quotes (symbols param)
├── bars/route.ts         GET    - Historical OHLCV data
└── assets/route.ts       GET    - Search tradeable assets
```

**Key Implementation Details:**
- Base URL: `https://paper-api.alpaca.markets` (paper) or `https://api.alpaca.markets` (live)
- Data URL: `https://data.alpaca.markets`
- Headers: `APCA-API-KEY-ID`, `APCA-API-SECRET-KEY`
- All routes check `ALPACA_PAPER` env var to determine endpoint

### 1.2 Finnhub Routes (`app/api/trading/finnhub/`)

```
app/api/trading/finnhub/
├── quote/route.ts        GET    - Real-time quote for symbol
├── candles/route.ts      GET    - Historical candles (OHLCV)
├── news/route.ts         GET    - Company or market news
├── sentiment/route.ts    GET    - Social sentiment scores
├── fundamentals/route.ts GET    - Company financials, metrics
├── peers/route.ts        GET    - Similar companies
└── recommendations/route.ts GET - Analyst recommendations
```

**Key Implementation Details:**
- Base URL: `https://finnhub.io/api/v1`
- Auth: `?token=FINNHUB_API_KEY` query param
- Rate limit: 60 calls/minute on free tier

### 1.3 Tavily Routes (`app/api/trading/tavily/`)

```
app/api/trading/tavily/
└── search/route.ts       POST   - AI-powered web search
```

**Key Implementation Details:**
- Base URL: `https://api.tavily.com`
- Auth: `api_key` in JSON body
- Returns: Summarized results with sources

---

## Phase 2: Zustand Store (`lib/stores/tradingStore.ts`)

```typescript
interface TradingState {
  // Account
  account: AlpacaAccount | null;
  positions: Position[];
  orders: Order[];

  // Market Data
  watchlist: string[];
  quotes: Record<string, Quote>;

  // UI State
  selectedSymbol: string | null;
  timeframe: '1D' | '1W' | '1M' | '3M' | '1Y';

  // Actions
  fetchAccount: () => Promise<void>;
  fetchPositions: () => Promise<void>;
  fetchQuotes: (symbols: string[]) => Promise<void>;
  placeOrder: (order: OrderRequest) => Promise<Order>;
  cancelOrder: (orderId: string) => Promise<void>;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
}
```

---

## Phase 3: UI Components

### 3.1 Trading Page (`app/trading/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [SARGE Header with Trading tab active]                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌───────────────────────────────────────────────────┐  │
│ │  Watchlist  │ │                    Chart                          │  │
│ │             │ │  ┌─────────────────────────────────────────────┐  │  │
│ │  AAPL ▲2.1% │ │  │                                             │  │  │
│ │  MSFT ▼0.3% │ │  │         TradingView Lightweight Chart       │  │  │
│ │  GOOGL▲1.5% │ │  │              or Recharts                    │  │  │
│ │  NVDA ▲3.2% │ │  │                                             │  │  │
│ │             │ │  └─────────────────────────────────────────────┘  │  │
│ │  + Add      │ │  [1D] [1W] [1M] [3M] [1Y]                        │  │
│ ├─────────────┤ ├───────────────────────────────────────────────────┤  │
│ │  Account    │ │                 Order Panel                       │  │
│ │             │ │  ┌─────────────────────────────────────────────┐  │  │
│ │  Cash:      │ │  │ [BUY] [SELL]   Symbol: [AAPL    ]          │  │  │
│ │  $100,000   │ │  │ Qty: [10]  Type: [Market ▼]  [Place Order] │  │  │
│ │             │ │  └─────────────────────────────────────────────┘  │  │
│ │  Buying Pwr:│ ├───────────────────────────────────────────────────┤  │
│ │  $200,000   │ │                 Positions                         │  │
│ │             │ │  Symbol  Qty   Avg Cost   Current   P/L           │  │
│ │  Equity:    │ │  AAPL    10    $150.00    $155.00   +$50 (+3.3%)  │  │
│ │  $100,000   │ │  MSFT    5     $400.00    $395.00   -$25 (-1.3%)  │  │
│ └─────────────┘ └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                          AI Analysis Panel                              │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [Analyze AAPL] [Get News] [Check Sentiment] [Risk Assessment]       │ │
│ │                                                                      │ │
│ │ AI Response streams here...                                          │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Breakdown

```
components/Trading/
├── TradingPage.tsx           # Main container
├── Watchlist.tsx             # Symbol list with quick quotes
├── AccountPanel.tsx          # Cash, buying power, equity
├── Chart.tsx                 # Price chart (lightweight-charts or recharts)
├── OrderPanel.tsx            # Buy/sell form
├── PositionsTable.tsx        # Current holdings
├── OrdersTable.tsx           # Open/filled orders
├── AIAnalysisPanel.tsx       # Chat with trading context
├── NewsPanel.tsx             # Finnhub news feed
└── SymbolSearch.tsx          # Autocomplete asset search
```

---

## Phase 4: AI Integration

### 4.1 Trading System Prompts

Each "brain" gets a specialized system prompt:

**Brain 1 - Market Data:**
```
You are a market data analyst. You have access to real-time quotes, historical prices, and asset information. When asked about a stock:
1. Fetch current quote
2. Get recent price history
3. Summarize price action and trends
Be concise. Use numbers and percentages.
```

**Brain 2 - News Search:**
```
You are a financial news researcher. Use Tavily and Finnhub to find:
1. Recent news about the company/sector
2. Earnings reports and guidance
3. Analyst coverage and ratings
Summarize key points. Cite sources.
```

**Brain 3 - Sentiment Analyst:**
```
You are a sentiment analyst. Analyze:
1. Social media sentiment scores
2. News sentiment (bullish/bearish)
3. Insider trading activity
4. Institutional holdings changes
Provide a sentiment score: Strong Buy / Buy / Hold / Sell / Strong Sell
```

**Brain 4 - Technical Analyst:**
```
You are a technical analyst. Given price data, analyze:
1. Support and resistance levels
2. Moving averages (20, 50, 200 day)
3. RSI, MACD indicators
4. Chart patterns
Provide entry/exit price suggestions.
```

**Brain 5 - Risk Manager:**
```
You are a risk manager. Before any trade, assess:
1. Position size relative to portfolio
2. Correlation with existing positions
3. Maximum drawdown potential
4. Stop-loss recommendations
Block trades that exceed risk parameters.
```

### 4.2 Orchestrator Flow

```typescript
async function analyzeStock(symbol: string) {
  // 1. Gather data in parallel
  const [quote, news, sentiment, history] = await Promise.all([
    fetchQuote(symbol),           // Brain 1
    searchNews(symbol),           // Brain 2
    getSentiment(symbol),         // Brain 3
    getHistory(symbol, '3M')      // Brain 1
  ]);

  // 2. Run analysis in parallel
  const [technical, risk] = await Promise.all([
    analyzeTechnicals(history),   // Brain 4
    assessRisk(symbol, quote)     // Brain 5
  ]);

  // 3. Orchestrator synthesizes
  const summary = await synthesize({
    quote, news, sentiment, technical, risk
  });

  return summary;
}
```

---

## Phase 5: File Structure

```
app/
├── trading/
│   └── page.tsx                    # Trading page
├── api/trading/
│   ├── alpaca/
│   │   ├── account/route.ts
│   │   ├── positions/route.ts
│   │   ├── orders/route.ts
│   │   ├── quotes/route.ts
│   │   ├── bars/route.ts
│   │   └── assets/route.ts
│   ├── finnhub/
│   │   ├── quote/route.ts
│   │   ├── candles/route.ts
│   │   ├── news/route.ts
│   │   ├── sentiment/route.ts
│   │   └── fundamentals/route.ts
│   └── tavily/
│       └── search/route.ts

components/Trading/
├── TradingPage.tsx
├── Watchlist.tsx
├── AccountPanel.tsx
├── Chart.tsx
├── OrderPanel.tsx
├── PositionsTable.tsx
├── OrdersTable.tsx
├── AIAnalysisPanel.tsx
├── NewsPanel.tsx
└── SymbolSearch.tsx

lib/
├── stores/
│   └── tradingStore.ts
├── trading/
│   ├── alpaca.ts                   # Alpaca client helpers
│   ├── finnhub.ts                  # Finnhub client helpers
│   ├── tavily.ts                   # Tavily client helpers
│   └── brains.ts                   # AI brain system prompts
└── types/
    └── trading.ts                  # TypeScript interfaces
```

---

## Implementation Order

### Sprint 1: Foundation (API Routes)
1. [ ] Create `lib/types/trading.ts` with all interfaces
2. [ ] Create Alpaca routes (account, positions, orders, quotes)
3. [ ] Create Finnhub routes (quote, news, sentiment)
4. [ ] Create Tavily route (search)
5. [ ] Test all routes with curl/Postman

### Sprint 2: State Management
6. [ ] Create `tradingStore.ts` with Zustand
7. [ ] Implement data fetching actions
8. [ ] Add watchlist persistence (localStorage)
9. [ ] Add polling for real-time quote updates

### Sprint 3: Basic UI
10. [ ] Create TradingPage layout
11. [ ] Build Watchlist component
12. [ ] Build AccountPanel component
13. [ ] Build PositionsTable component
14. [ ] Build OrderPanel (buy/sell form)
15. [ ] Add Trading to nav

### Sprint 4: Charts & Orders
16. [ ] Integrate lightweight-charts or recharts
17. [ ] Implement order placement flow
18. [ ] Add order confirmation modal
19. [ ] Build OrdersTable (open/filled)

### Sprint 5: AI Integration
20. [ ] Create brain system prompts
21. [ ] Build AIAnalysisPanel component
22. [ ] Implement parallel brain queries
23. [ ] Add orchestrator synthesis
24. [ ] Stream AI responses to UI

### Sprint 6: Polish
25. [ ] Add symbol autocomplete search
26. [ ] Add news panel
27. [ ] Add keyboard shortcuts
28. [ ] Error handling & loading states
29. [ ] Mobile responsive layout
30. [ ] Dark mode support (already have)

---

## API Response Types

### Alpaca Account
```typescript
interface AlpacaAccount {
  id: string;
  account_number: string;
  status: 'ACTIVE' | 'INACTIVE';
  currency: string;
  cash: string;
  buying_power: string;
  equity: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
}
```

### Alpaca Position
```typescript
interface Position {
  asset_id: string;
  symbol: string;
  qty: string;
  avg_entry_price: string;
  market_value: string;
  current_price: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  side: 'long' | 'short';
}
```

### Alpaca Order
```typescript
interface Order {
  id: string;
  symbol: string;
  qty: string;
  filled_qty: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  status: 'new' | 'filled' | 'partially_filled' | 'canceled';
  created_at: string;
  filled_at: string | null;
  limit_price?: string;
  stop_price?: string;
}
```

### Finnhub Quote
```typescript
interface FinnhubQuote {
  c: number;   // Current price
  d: number;   // Change
  dp: number;  // Percent change
  h: number;   // High
  l: number;   // Low
  o: number;   // Open
  pc: number;  // Previous close
  t: number;   // Timestamp
}
```

### Finnhub News
```typescript
interface FinnhubNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}
```

---

## Security Considerations

1. **API Keys**: Never expose in client-side code. All calls go through Next.js API routes.
2. **Paper Trading Default**: Always default to paper trading. Require explicit confirmation for live.
3. **Order Confirmation**: Always show confirmation modal before placing orders.
4. **Rate Limiting**: Implement client-side throttling to avoid API limits.
5. **Error Handling**: Never expose raw API errors to UI. Sanitize messages.

---

## Environment Variables Required

```env
# Alpaca
ALPACA_API_KEY=your_key
ALPACA_API_SECRET=your_secret
ALPACA_PAPER=true

# Finnhub
FINNHUB_API_KEY=your_key

# Tavily
TAVILY_API_KEY=your_key
```

---

## Questions for Review

1. Should we use TradingView's lightweight-charts (better for trading) or Recharts (already in project)?
2. Should the AI analysis use the existing parallel chat system or a dedicated trading chat?
3. Do we need WebSocket connections for real-time streaming, or is polling sufficient for MVP?
4. Should positions/orders auto-refresh, or only on user action?
5. Do we want to support options trading in v1, or stocks only?

---

## Success Criteria

- [ ] Can view account balance and buying power
- [ ] Can add/remove symbols from watchlist
- [ ] Can see real-time quotes for watchlist
- [ ] Can view price chart with multiple timeframes
- [ ] Can place market/limit orders
- [ ] Can view and cancel open orders
- [ ] Can see current positions with P/L
- [ ] AI can analyze stocks using all 5 brains
- [ ] News feed shows relevant articles
- [ ] All actions work in paper trading mode
