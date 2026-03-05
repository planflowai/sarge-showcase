"use client";

import { TrendingUp, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { inputCls, cardCls, dashedCardCls } from "@/components/settings/settingsStyles";

export function SettingsTradingAPIs() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Trading API Keys</h2>
        <p className="mb-4 text-xs font-medium text-zinc-300 dark:text-zinc-300">
          Configure API keys for market data and trading. Keys are stored in your <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">.env.local</code> file.
        </p>
      </div>

      {/* Alpaca */}
      <section className={cardCls}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">Alpaca</h3>
            <p className="text-xs text-zinc-300">Stock trading & real-time market data</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1 block">ALPACA_API_KEY</label>
            <div className="flex items-center gap-2">
              <Input type="password" placeholder="PK..." disabled className={`flex-1 ${inputCls}`} value="••••••••••••••••" />
              <span className="text-xs text-zinc-400">.env.local</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1 block">ALPACA_SECRET_KEY</label>
            <div className="flex items-center gap-2">
              <Input type="password" placeholder="Your secret key..." disabled className={`flex-1 ${inputCls}`} value="••••••••••••••••" />
              <span className="text-xs text-zinc-400">.env.local</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1 block">ALPACA_PAPER</label>
            <div className="flex items-center gap-2">
              <Input type="text" placeholder="true or false" disabled className={`w-24 ${inputCls}`} value="true" />
              <span className="text-xs text-zinc-300">Use paper trading (recommended for testing)</span>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <p className="text-xs text-zinc-300 dark:text-zinc-400">
            Get your keys at{" "}
            <a href="https://app.alpaca.markets" target="_blank" rel="noopener noreferrer" className="text-yellow-600 dark:text-yellow-400 hover:underline">
              app.alpaca.markets
            </a>
            {" "}&rarr; API Keys &rarr; Generate New Key (Paper Trading)
          </p>
        </div>
      </section>

      {/* Finnhub */}
      <section className={cardCls}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">Finnhub</h3>
            <p className="text-xs text-zinc-300">News, sentiment, earnings & fundamentals</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1 block">FINNHUB_API_KEY</label>
            <div className="flex items-center gap-2">
              <Input type="password" placeholder="Your Finnhub API key..." disabled className={`flex-1 ${inputCls}`} value="••••••••••••••••" />
              <span className="text-xs text-zinc-400">.env.local</span>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <p className="text-xs text-zinc-300 dark:text-zinc-400">
            Get your free key at{" "}
            <a href="https://finnhub.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
              finnhub.io
            </a>
            {" "}&rarr; Sign up &rarr; Dashboard &rarr; API Key
          </p>
        </div>
      </section>

      {/* Tavily */}
      <section className={cardCls}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Database className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">Tavily</h3>
            <p className="text-xs text-zinc-300">Real-time web search for news & fact-checking</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1 block">TAVILY_API_KEY</label>
            <div className="flex items-center gap-2">
              <Input type="password" placeholder="tvly-..." disabled className={`flex-1 ${inputCls}`} value="••••••••••••••••" />
              <span className="text-xs text-zinc-400">.env.local</span>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <p className="text-xs text-zinc-300 dark:text-zinc-400">
            1,000 free credits/month at{" "}
            <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 hover:underline">
              tavily.com
            </a>
          </p>
        </div>
      </section>

      {/* .env.local Template */}
      <section className={dashedCardCls}>
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-white mb-2">Quick Setup</h3>
        <p className="text-xs text-zinc-300 dark:text-zinc-400 mb-3">
          Add these to your <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">.env.local</code> file:
        </p>
        <pre className="text-xs bg-zinc-900 text-green-400 p-3 rounded-lg overflow-x-auto">
{`# Trading APIs
ALPACA_API_KEY=your_alpaca_key_here
ALPACA_SECRET_KEY=your_alpaca_secret_here
ALPACA_PAPER=true

FINNHUB_API_KEY=your_finnhub_key_here

TAVILY_API_KEY=tvly-your_key_here`}
        </pre>
      </section>
    </div>
  );
}
