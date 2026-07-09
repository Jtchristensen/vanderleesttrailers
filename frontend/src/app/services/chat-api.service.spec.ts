import { TestBed } from '@angular/core/testing';
import { ChatApiService } from './chat-api.service';
import type { ChatMessage } from './chat.service';

describe('ChatApiService', () => {
  let service: ChatApiService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ChatApiService] });
    service = TestBed.inject(ChatApiService);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs to /api/chat with sessionId and messages and returns the reply', async () => {
    const fetchSpy = jasmine.createSpy('fetch').and.resolveTo(
      new Response(JSON.stringify({ reply: 'hi there' }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy;

    const msgs: ChatMessage[] = [{ role: 'user', content: 'hi' }];
    const result = await service.sendMessage('sess-1', msgs);

    expect(result).toBe('hi there');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.calls.mostRecent().args;
    expect(url).toContain('/chat');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.sessionId).toBe('sess-1');
    expect(body.messages).toEqual(msgs);
  });

  it('includes the vehicle in the request body when provided', async () => {
    const fetchSpy = jasmine.createSpy('fetch').and.resolveTo(
      new Response(JSON.stringify({ reply: 'hi' }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy;

    await service.sendMessage('sess-1', [], { name: 'Ford F-150', capacity: 13500 });
    const body = JSON.parse((fetchSpy.calls.mostRecent().args[1] as RequestInit).body as string);
    expect(body.vehicle).toEqual({ name: 'Ford F-150', capacity: 13500 });
  });

  it('sends a null vehicle when none is provided', async () => {
    const fetchSpy = jasmine.createSpy('fetch').and.resolveTo(
      new Response(JSON.stringify({ reply: 'hi' }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy;

    await service.sendMessage('sess-1', []);
    const body = JSON.parse((fetchSpy.calls.mostRecent().args[1] as RequestInit).body as string);
    expect(body.vehicle).toBeNull();
  });

  it('throws a "rate_limited" error on 429', async () => {
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo(
      new Response('', { status: 429 }),
    );
    await expectAsync(service.sendMessage('s', [])).toBeRejectedWithError(/rate_limited/);
  });

  it('throws a generic error on other non-OK responses', async () => {
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo(
      new Response('boom', { status: 500 }),
    );
    await expectAsync(service.sendMessage('s', [])).toBeRejectedWithError(/chat_failed/);
  });
});
