import { TestBed } from '@angular/core/testing';
import { ChatService, ChatMessage } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    localStorage.removeItem('vl_chat_v1');
    TestBed.configureTestingModule({ providers: [ChatService] });
    service = TestBed.inject(ChatService);
  });

  afterEach(() => {
    localStorage.removeItem('vl_chat_v1');
  });

  it('generates a session id on first access', () => {
    const id = service.sessionId;
    expect(id).toMatch(/^[0-9a-f-]{8,}$/);
  });

  it('persists the same session id across instances', () => {
    const id1 = service.sessionId;
    const service2 = TestBed.inject(ChatService);
    expect(service2.sessionId).toBe(id1);
  });

  it('starts closed', () => {
    expect(service.isOpen()).toBeFalse();
  });

  it('toggles open/closed', () => {
    service.toggle();
    expect(service.isOpen()).toBeTrue();
    service.toggle();
    expect(service.isOpen()).toBeFalse();
  });

  it('appends messages and exposes them in order', () => {
    service.appendMessage({ role: 'user', content: 'hi' });
    service.appendMessage({ role: 'assistant', content: 'hello' });
    const msgs = service.messages();
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[1].role).toBe('assistant');
  });

  it('persists messages to localStorage', () => {
    service.appendMessage({ role: 'user', content: 'hi' });
    const raw = localStorage.getItem('vl_chat_v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.messages.length).toBe(1);
    expect(parsed.sessionId).toBe(service.sessionId);
  });

  it('rehydrates messages on construction', () => {
    localStorage.setItem('vl_chat_v1', JSON.stringify({
      sessionId: 'rehydrated-session',
      messages: [{ role: 'user', content: 'earlier' }],
    }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ChatService] });
    const s = TestBed.inject(ChatService);
    expect(s.sessionId).toBe('rehydrated-session');
    expect(s.messages()[0].content).toBe('earlier');
  });

  it('trims history to the last 20 turns when sending (stripping any leading assistant turn)', () => {
    const many: ChatMessage[] = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: String(i),
    }));
    many.forEach(m => service.appendMessage(m));
    const forSend = service.messagesForSend();
    // slice(-20) starts at index 5 (assistant); stripping leaves 19 starting at index 6 (user).
    expect(forSend.length).toBe(19);
    expect(forSend[0].role).toBe('user');
    expect(forSend[0].content).toBe('6');
    expect(forSend[18].content).toBe('24');
  });

  it('strips any leading assistant greeting from messagesForSend', () => {
    service.appendMessage({ role: 'assistant', content: 'Hey there!' });
    service.appendMessage({ role: 'user', content: 'hi' });
    service.appendMessage({ role: 'assistant', content: 'what can I do?' });
    const forSend = service.messagesForSend();
    expect(forSend[0].role).toBe('user');
    expect(forSend[0].content).toBe('hi');
    expect(forSend.length).toBe(2);
  });

  it('strips multiple leading assistant messages', () => {
    service.appendMessage({ role: 'assistant', content: 'greeting 1' });
    service.appendMessage({ role: 'assistant', content: 'greeting 2' });
    service.appendMessage({ role: 'user', content: 'hi' });
    const forSend = service.messagesForSend();
    expect(forSend.length).toBe(1);
    expect(forSend[0].role).toBe('user');
  });

  it('resets state and clears localStorage', () => {
    service.appendMessage({ role: 'user', content: 'hi' });
    service.reset();
    expect(service.messages().length).toBe(0);
    expect(localStorage.getItem('vl_chat_v1')).toBeNull();
  });
});
