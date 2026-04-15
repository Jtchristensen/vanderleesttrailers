import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { ChatWidgetComponent } from './chat-widget.component';
import { ChatService } from '../../services/chat.service';
import { ChatApiService } from '../../services/chat-api.service';

@Component({ standalone: true, template: '' })
class DummyComponent {}

describe('ChatWidgetComponent — closed bubble', () => {
  let fixture: ComponentFixture<ChatWidgetComponent>;
  let chat: ChatService;

  beforeEach(async () => {
    localStorage.removeItem('vl_chat_v1');
    await TestBed.configureTestingModule({
      imports: [ChatWidgetComponent],
      providers: [
        provideRouter([
          { path: '', component: DummyComponent },
          { path: 'admin', component: DummyComponent },
        ]),
        ChatService,
        {
          provide: ChatApiService,
          useValue: { sendMessage: jasmine.createSpy('sendMessage').and.resolveTo('ok') },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ChatWidgetComponent);
    chat = TestBed.inject(ChatService);
  });

  afterEach(() => localStorage.removeItem('vl_chat_v1'));

  it('renders the closed bubble with label "Talk to AI Trailer Man"', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const pill = el.querySelector('.bubble-pill');
    expect(pill?.textContent).toContain('Talk to AI Trailer Man');
  });

  it('hides on /admin routes', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.bubble-pill')).toBeNull();
    expect(el.querySelector('.panel')).toBeNull();
  });

  it('opens the panel when the bubble is clicked', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.bubble-pill') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.panel')).not.toBeNull();
    expect(chat.isOpen()).toBeTrue();
  });
});

describe('ChatWidgetComponent — send flow', () => {
  let fixture: ComponentFixture<ChatWidgetComponent>;
  let apiSpy: jasmine.SpyObj<ChatApiService>;
  let chat: ChatService;

  beforeEach(async () => {
    localStorage.removeItem('vl_chat_v1');
    apiSpy = jasmine.createSpyObj<ChatApiService>('ChatApiService', ['sendMessage']);
    await TestBed.configureTestingModule({
      imports: [ChatWidgetComponent],
      providers: [
        provideRouter([{ path: '', component: DummyComponent }]),
        ChatService,
        { provide: ChatApiService, useValue: apiSpy },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ChatWidgetComponent);
    chat = TestBed.inject(ChatService);
  });

  afterEach(() => localStorage.removeItem('vl_chat_v1'));

  it('sends the user message, appends the assistant reply', async () => {
    apiSpy.sendMessage.and.resolveTo('Sure — what kind?');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.bubble-pill') as HTMLElement).click();
    fixture.detectChanges();

    fixture.componentInstance.draft.set('I need a dump trailer');
    await fixture.componentInstance.send();
    fixture.detectChanges();

    const msgs = chat.messages();
    expect(msgs.length).toBe(3);
    expect(msgs[1]).toEqual({ role: 'user', content: 'I need a dump trailer' });
    expect(msgs[2]).toEqual({ role: 'assistant', content: 'Sure — what kind?' });
    expect(apiSpy.sendMessage).toHaveBeenCalledWith(chat.sessionId, jasmine.any(Array));
  });

  it('renders an apology when the API throws', async () => {
    apiSpy.sendMessage.and.rejectWith(new Error('chat_failed'));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.bubble-pill') as HTMLElement).click();
    fixture.detectChanges();

    fixture.componentInstance.draft.set('hi');
    await fixture.componentInstance.send();
    fixture.detectChanges();

    const msgs = chat.messages();
    expect(msgs[msgs.length - 1].content).toContain('trouble');
  });

  it('shows a rate-limit message on 429', async () => {
    apiSpy.sendMessage.and.rejectWith(new Error('rate_limited'));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.bubble-pill') as HTMLElement).click();
    fixture.detectChanges();

    fixture.componentInstance.draft.set('spam');
    await fixture.componentInstance.send();
    fixture.detectChanges();

    const last = chat.messages().at(-1)!;
    expect(last.content).toContain('very quickly');
  });
});
