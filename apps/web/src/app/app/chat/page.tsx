'use client';

import { useState } from 'react';

interface Citation {
  title: string;
  snippet: string;
  score: number;
  index: number;
}

export default function ChatPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setError(null);
    setAnswer('');
    setCitations([]);
    setStreaming(true);
    try {
      const convRes = await fetch('/api/proxy/v1/conversations', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!convRes.ok) throw new Error('Could not create conversation');
      const conv = (await convRes.json()) as { id: string };

      const res = await fetch(`/api/proxy/v1/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!res.ok || !res.body) {
        const fallback = await fetch(`/api/proxy/v1/conversations/${conv.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ question }),
        });
        const data = (await fallback.json()) as {
          content: string;
          citations: Citation[];
          error?: { message: string };
        };
        if (!fallback.ok) throw new Error(data.error?.message ?? 'Chat failed');
        setAnswer(data.content);
        setCitations(data.citations ?? []);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assembled = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const lines = part.split('\n');
          const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim();
          const dataLine = lines.find((l) => l.startsWith('data:'))?.slice(5).trim();
          if (!event || !dataLine) continue;
          const data = JSON.parse(dataLine) as {
            text?: string;
            title?: string;
            snippet?: string;
            score?: number;
            index?: number;
          };
          if (event === 'token' && data.text) {
            assembled += data.text;
            setAnswer(assembled);
          }
          if (event === 'citation' && data.title) {
            setCitations((prev) => [
              ...prev,
              {
                title: data.title!,
                snippet: data.snippet ?? '',
                score: data.score ?? 0,
                index: data.index ?? prev.length + 1,
              },
            ]);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setStreaming(false);
    }
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Chat</h1>
      <p className="mt-1 text-sm text-ink/70">
        Answers are grounded in your knowledge base with citations.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-xl border border-ink/10 bg-white/70 p-4">
          <label className="block text-sm font-medium" htmlFor="question">
            Question
          </label>
          <textarea
            id="question"
            className="mt-2 min-h-28 w-full rounded-md border border-ink/15 bg-white px-3 py-2"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void ask()}
            disabled={streaming || !question.trim()}
            className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {streaming ? 'Thinking…' : 'Ask'}
          </button>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div
            className="mt-6 whitespace-pre-wrap text-sm leading-relaxed"
            aria-live="polite"
            aria-busy={streaming}
          >
            {answer || (streaming ? '…' : 'Ask a question to see a grounded answer.')}
          </div>
        </section>

        <aside className="rounded-xl border border-ink/10 bg-white/70 p-4" aria-label="Citations">
          <h2 className="text-sm font-semibold">Citations</h2>
          <ul className="mt-3 space-y-3">
            {citations.length === 0 ? (
              <li className="text-sm text-ink/60">None yet</li>
            ) : (
              citations.map((c) => (
                <li key={`${c.index}-${c.title}`} className="text-sm">
                  <p className="font-medium">
                    [{c.index}] {c.title}
                  </p>
                  <p className="mt-1 text-ink/70">{c.snippet}</p>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </main>
  );
}
