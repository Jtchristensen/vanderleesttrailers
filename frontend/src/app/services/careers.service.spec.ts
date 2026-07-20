import { TestBed } from '@angular/core/testing';
import { CareersService } from './careers.service';

describe('CareersService', () => {
  let service: CareersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CareersService);
  });

  it('POSTs the application to /api/apply', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(
      new Response('{"ok":true}', { status: 200 }),
    );
    await service.apply({ name: 'A', email: 'a@b.com', phone: '1' });
    expect(fetchSpy).toHaveBeenCalled();
    const [url, opts] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toContain('/apply');
    expect(opts.method).toBe('POST');
  });

  it('throws when the response is not OK', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response('', { status: 502 }));
    await expectAsync(
      service.apply({ name: 'A', email: 'a@b.com', phone: '1' }),
    ).toBeRejected();
  });
});
