import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '../../core/auth';
import { CopilotEvent } from '../../core/models';
import { CopilotStore } from './copilot.store';

/** SSE response whose bytes arrive in arbitrary chunks (frames split mid-way). */
function sseResponse(events: CopilotEvent[], chunkSize = 7) {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

describe('CopilotStore', () => {
  let store: CopilotStore;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(CopilotStore);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    // Every send refreshes the conversation list; answer it so verify() passes.
    const backend = TestBed.inject(HttpTestingController);
    backend.match('/api/ai/copilot/conversations').forEach((r) => r.flush([]));
    backend.verify();
  });

  it('streams text, thinking and tool cards into the assistant bubble', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        { type: 'conversation', id: 42, title: 'Áticos' },
        { type: 'thinking', delta: 'Busco ' },
        { type: 'thinking', delta: 'áticos' },
        { type: 'tool_start', id: 't1', name: 'search_properties' },
        { type: 'tool_end', id: 't1', name: 'search_properties', ok: true, ui: { kind: 'properties', items: [] } },
        { type: 'text', delta: 'Hay **2** ' },
        { type: 'text', delta: 'áticos.' },
        { type: 'done' },
      ]),
    );

    await store.send('  ¿Qué áticos hay?  ');

    expect(store.conversationId()).toBe(42);
    expect(store.streaming()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.turns()).toEqual([
      { role: 'user', parts: [{ type: 'text', text: '¿Qué áticos hay?' }] },
      {
        role: 'assistant',
        parts: [
          { type: 'thinking', text: 'Busco áticos' },
          { type: 'tool', id: 't1', name: 'search_properties', pending: false, ok: true, ui: { kind: 'properties', items: [] } },
          { type: 'text', text: 'Hay **2** áticos.' },
        ],
      },
    ]);
    expect(store.dataVersion()).toBe(0);
  });

  it('sends the token and continues the same conversation', async () => {
    vi.spyOn(TestBed.inject(Auth), 'token').mockReturnValue('jwt-9');
    fetchMock.mockImplementation(async () => sseResponse([{ type: 'conversation', id: 7, title: 't' }, { type: 'done' }]));
    await store.send('hola');
    await store.send('¿y ahora?');

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/ai/copilot/chat');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-9');
    expect((init.headers as Record<string, string>)['X-Lang']).toBe('es');
    expect(JSON.parse(init.body)).toEqual({ conversationId: 7, message: '¿y ahora?' });
  });

  it('signals data changes when a write tool succeeds', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        { type: 'tool_start', id: 'a', name: 'schedule_visit' },
        { type: 'tool_end', id: 'a', name: 'schedule_visit', ok: true },
        { type: 'tool_start', id: 'b', name: 'update_client' },
        { type: 'tool_end', id: 'b', name: 'update_client', ok: false },
        { type: 'done' },
      ]),
    );
    await store.send('agenda la visita');
    expect(store.dataVersion()).toBe(1);
  });

  it('shows the API error and drops the empty assistant bubble', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'La IA no está configurada' }), { status: 503 }),
    );
    await store.send('hola');
    expect(store.error()).toBe('La IA no está configurada');
    expect(store.turns()).toEqual([{ role: 'user', parts: [{ type: 'text', text: 'hola' }] }]);
  });

  it('logs out when the session expired', async () => {
    const logout = vi.spyOn(TestBed.inject(Auth), 'logout').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await store.send('hola');
    expect(logout).toHaveBeenCalled();
  });

  it('ignores blank messages and messages sent while streaming', async () => {
    await store.send('   ');
    store.streaming.set(true);
    await store.send('hola');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.turns()).toEqual([]);
  });

  it('resets the chat', () => {
    store.conversationId.set(3);
    store.turns.set([{ role: 'user', parts: [] }]);
    store.error.set('x');
    store.newChat();
    expect([store.conversationId(), store.turns(), store.error()]).toEqual([null, [], null]);
  });
});
