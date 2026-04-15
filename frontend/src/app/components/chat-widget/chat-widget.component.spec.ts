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

  it('renders the closed bubble with label "Talk to AI Matt"', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const pill = el.querySelector('.bubble-pill');
    expect(pill?.textContent).toContain('Talk to AI Matt');
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
