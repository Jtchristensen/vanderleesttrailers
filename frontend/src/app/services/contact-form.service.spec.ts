import { TestBed } from '@angular/core/testing';
import { ContactFormService } from './contact-form.service';

describe('ContactFormService', () => {
  let service: ContactFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ContactFormService);
  });

  it('POSTs the submission to /api/contact', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(
      new Response('{"ok":true}', { status: 200 }),
    );
    await service.submit({ name: 'A', email: 'a@b.com', phone: '1', message: 'Hi' });
    expect(fetchSpy).toHaveBeenCalled();
    const [url, opts] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toContain('/contact');
    expect(opts.method).toBe('POST');
  });

  it('throws when the response is not OK', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response('', { status: 502 }));
    await expectAsync(
      service.submit({ name: 'A', email: 'a@b.com', phone: '1', message: 'Hi' }),
    ).toBeRejected();
  });
});
