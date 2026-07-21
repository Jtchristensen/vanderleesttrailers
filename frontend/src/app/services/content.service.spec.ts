import { TestBed } from '@angular/core/testing';
import { ContentService } from './content.service';
import * as staticContent from '../data/site-content';

describe('ContentService', () => {
  let service: ContentService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ContentService] });
    service = TestBed.inject(ContentService);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    service.clearCache();
  });

  describe('getContentSync (static)', () => {
    it('returns the static fallback for a known type', () => {
      expect(ContentService.getContentSync('SITE_INFO')).toBe(staticContent.SITE_INFO);
      expect(ContentService.getContentSync('PAGE_HOME')).toBe(staticContent.HOME_CONTENT);
      expect(ContentService.getContentSync('FINANCING')).toBe(staticContent.FINANCING_CONTENT);
    });

    it('returns an empty object for an unknown type so template paths do not crash', () => {
      expect(ContentService.getContentSync('DOES_NOT_EXIST')).toEqual({});
    });

    it('returns a synchronous value (not a Promise)', () => {
      const result = ContentService.getContentSync('SITE_INFO');
      expect(result).not.toEqual(jasmine.any(Promise));
    });
  });

  describe('getContent (async)', () => {
    it('returns API data on success', async () => {
      const apiPayload = { marker: 'from-api' };
      globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo(
        new Response(JSON.stringify(apiPayload), { status: 200 }),
      );
      const result = await service.getContent<any>('SITE_INFO');
      expect(result).toEqual(apiPayload);
    });

    it('falls back to static content when fetch rejects', async () => {
      globalThis.fetch = jasmine.createSpy('fetch').and.rejectWith(new Error('network down'));
      const result = await service.getContent('SITE_INFO');
      expect(result).toBe(staticContent.SITE_INFO);
    });

    it('falls back to static content when API returns non-OK', async () => {
      globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo(new Response('oops', { status: 500 }));
      const result = await service.getContent('SITE_INFO');
      expect(result).toBe(staticContent.SITE_INFO);
    });

    it('caches successful responses so repeat calls skip the network', async () => {
      const apiPayload = { marker: 'cached' };
      const fetchSpy = jasmine.createSpy('fetch').and.resolveTo(
        new Response(JSON.stringify(apiPayload), { status: 200 }),
      );
      globalThis.fetch = fetchSpy;
      await service.getContent('SITE_INFO');
      await service.getContent('SITE_INFO');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to static content when the API returns an empty array (missing row)', async () => {
      globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo(new Response('[]', { status: 200 }));
      const result = await service.getContent('CAREERS');
      expect(result).toBe(staticContent.CAREERS_CONTENT);
    });

    it('falls back to static content when the API returns an empty object', async () => {
      globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo(new Response('{}', { status: 200 }));
      const result = await service.getContent('SITE_INFO');
      expect(result).toBe(staticContent.SITE_INFO);
    });

    it('does not cache a blank response, so a later good response is used', async () => {
      const fetchSpy = jasmine.createSpy('fetch')
        .and.resolveTo(new Response('[]', { status: 200 }));
      globalThis.fetch = fetchSpy;
      await service.getContent('CAREERS');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      // second call must hit the network again rather than serve a cached blank
      await service.getContent('CAREERS');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('throws for an unknown type when the API fails and no fallback exists', async () => {
      globalThis.fetch = jasmine.createSpy('fetch').and.rejectWith(new Error('down'));
      await expectAsync(service.getContent('NO_SUCH_TYPE')).toBeRejected();
    });
  });

  describe('getTrailers', () => {
    it('returns an empty array when the API fails (no static fallback)', async () => {
      globalThis.fetch = jasmine.createSpy('fetch').and.rejectWith(new Error('down'));
      const result = await service.getTrailers();
      expect(result).toEqual([]);
    });

    it('returns an empty array when the API responds with malformed JSON', async () => {
      globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo(new Response('not json', { status: 200 }));
      const result = await service.getTrailers();
      expect(result).toEqual([]);
    });

    it('returns API data on success', async () => {
      const apiPayload = [{ slug: 'a' }, { slug: 'b' }];
      globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo(
        new Response(JSON.stringify(apiPayload), { status: 200 }),
      );
      const result = await service.getTrailers();
      expect(result).toEqual(apiPayload);
    });

    it('caches successful responses so repeat calls skip the network', async () => {
      const apiPayload = [{ slug: 'a' }];
      const fetchSpy = jasmine.createSpy('fetch').and.resolveTo(
        new Response(JSON.stringify(apiPayload), { status: 200 }),
      );
      globalThis.fetch = fetchSpy;
      await service.getTrailers();
      await service.getTrailers();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
