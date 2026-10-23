import { Injectable, inject, signal } from '@angular/core';
import { Api, errorMessage } from '../../core/api';
import { Auth } from '../../core/auth';
import { currentLang } from '../../core/i18n';
import { ChatPart, ChatTurn, ConversationSummary, CopilotEvent } from '../../core/models';

/** Global copilot state: shared by the slide-over panel and the full page. */
@Injectable({ providedIn: 'root' })
export class CopilotStore {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);

  readonly panelOpen = signal(false);
  readonly conversationId = signal<number | null>(null);
  readonly turns = signal<ChatTurn[]>([]);
  readonly streaming = signal(false);
  readonly error = signal<string | null>(null);
  readonly history = signal<ConversationSummary[]>([]);
  /** Incremented whenever the copilot changes CRM data, so open views can refresh. */
  readonly dataVersion = signal(0);

  private abort?: AbortController;

  open(prompt?: string) {
    this.panelOpen.set(true);
    if (prompt) void this.send(prompt);
  }

  newChat() {
    this.stop();
    this.conversationId.set(null);
    this.turns.set([]);
    this.error.set(null);
  }

  async loadHistory() {
    try {
      this.history.set(await this.api.conversations());
    } catch {
      // History is optional; ignore failures.
    }
  }

  async openConversation(id: number) {
    this.stop();
    this.error.set(null);
    try {
      const conv = await this.api.conversation(id);
      this.conversationId.set(conv.id);
      this.turns.set(conv.turns);
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  async deleteConversation(id: number) {
    await this.api.deleteConversation(id);
    if (this.conversationId() === id) this.newChat();
    this.history.update((h) => h.filter((c) => c.id !== id));
  }

  stop() {
    this.abort?.abort();
    this.abort = undefined;
    this.streaming.set(false);
  }

  async send(text: string) {
    const message = text.trim();
    if (!message || this.streaming()) return;

    this.error.set(null);
    this.turns.update((t) => [
      ...t,
      { role: 'user', parts: [{ type: 'text', text: message }] },
      { role: 'assistant', parts: [] },
    ]);
    this.streaming.set(true);
    this.abort = new AbortController();

    try {
      const res = await fetch('/api/ai/copilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.auth.token()}`,
          'X-Lang': currentLang(),
        },
        body: JSON.stringify({
          conversationId: this.conversationId() ?? undefined,
          message,
        }),
        signal: this.abort.signal,
      });
      if (res.status === 401) {
        this.auth.logout();
        return;
      }
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Error ${res.status}`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (frame.startsWith('data: ')) this.apply(JSON.parse(frame.slice(6)) as CopilotEvent);
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') this.error.set(errorMessage(err));
    } finally {
      this.streaming.set(false);
      this.abort = undefined;
      // Drop an empty assistant bubble left by an early failure.
      this.turns.update((t) => (t.at(-1)?.role === 'assistant' && !t.at(-1)!.parts.length ? t.slice(0, -1) : t));
      void this.loadHistory();
    }
  }

  private apply(event: CopilotEvent) {
    switch (event.type) {
      case 'conversation':
        this.conversationId.set(event.id);
        return;
      case 'error':
        this.error.set(event.message);
        return;
      case 'done':
        return;
    }
    this.updateLast((parts) => {
      const last = parts.at(-1);
      switch (event.type) {
        case 'text':
          if (last?.type === 'text') return [...parts.slice(0, -1), { ...last, text: last.text + event.delta }];
          return [...parts, { type: 'text', text: event.delta }];
        case 'thinking':
          if (last?.type === 'thinking')
            return [...parts.slice(0, -1), { ...last, text: last.text + event.delta }];
          return [...parts, { type: 'thinking', text: event.delta }];
        case 'tool_start':
          return [...parts, { type: 'tool', id: event.id, name: event.name, pending: true }];
        case 'tool_end':
          if (['schedule_visit', 'update_client', 'update_property'].includes(event.name) && event.ok)
            this.dataVersion.update((v) => v + 1);
          return parts.map((p) =>
            p.type === 'tool' && p.id === event.id ? { ...p, pending: false, ok: event.ok, ui: event.ui } : p,
          );
      }
    });
  }

  private updateLast(fn: (parts: ChatPart[]) => ChatPart[]) {
    this.turns.update((turns) => {
      const last = turns.at(-1);
      if (last?.role !== 'assistant') return turns;
      return [...turns.slice(0, -1), { ...last, parts: fn(last.parts) }];
    });
  }
}
