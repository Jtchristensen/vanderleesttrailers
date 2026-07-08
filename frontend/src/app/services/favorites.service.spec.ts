import { TestBed } from '@angular/core/testing';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;

  beforeEach(() => {
    localStorage.removeItem('vlt-favorites');
    TestBed.configureTestingModule({ providers: [FavoritesService] });
    service = TestBed.inject(FavoritesService);
  });

  afterEach(() => {
    localStorage.removeItem('vlt-favorites');
  });

  it('starts empty', () => {
    expect(service.slugs()).toEqual([]);
    expect(service.count()).toBe(0);
  });

  it('toggle saves a trailer and reports it as a favorite', () => {
    service.toggle('dump-7x14');
    expect(service.isFavorite('dump-7x14')).toBeTrue();
    expect(service.count()).toBe(1);
  });

  it('toggle removes an already-saved trailer', () => {
    service.toggle('a');
    service.toggle('a');
    expect(service.slugs()).toEqual([]);
  });

  it('keeps insertion order and has no limit', () => {
    for (let i = 0; i < 10; i++) service.toggle(`trailer-${i}`);
    expect(service.count()).toBe(10);
    expect(service.slugs()[0]).toBe('trailer-0');
    expect(service.slugs()[9]).toBe('trailer-9');
  });

  it('remove and clear work', () => {
    service.toggle('a');
    service.toggle('b');
    service.remove('a');
    expect(service.slugs()).toEqual(['b']);
    service.clear();
    expect(service.slugs()).toEqual([]);
  });

  it('persists favorites to localStorage and restores them', () => {
    service.toggle('a');
    service.toggle('b');
    expect(JSON.parse(localStorage.getItem('vlt-favorites')!)).toEqual(['a', 'b']);

    // A fresh service instance (new page load) restores the same favorites
    const fresh = new FavoritesService();
    expect(fresh.slugs()).toEqual(['a', 'b']);
  });

  it('ignores corrupt localStorage data', () => {
    localStorage.setItem('vlt-favorites', '{{nope');
    const fresh = new FavoritesService();
    expect(fresh.slugs()).toEqual([]);
  });

  it('drops non-string entries from stored data', () => {
    localStorage.setItem('vlt-favorites', JSON.stringify(['a', 7, null, 'b']));
    const fresh = new FavoritesService();
    expect(fresh.slugs()).toEqual(['a', 'b']);
  });
});
