import { TestBed } from '@angular/core/testing';
import { CompareService, COMPARE_LIMIT } from './compare.service';

describe('CompareService', () => {
  let service: CompareService;

  beforeEach(() => {
    localStorage.removeItem('vlt-compare');
    TestBed.configureTestingModule({ providers: [CompareService] });
    service = TestBed.inject(CompareService);
  });

  afterEach(() => {
    localStorage.removeItem('vlt-compare');
  });

  it('starts empty', () => {
    expect(service.slugs()).toEqual([]);
    expect(service.count()).toBe(0);
    expect(service.isFull()).toBeFalse();
  });

  it('toggle adds a trailer and reports it as selected', () => {
    expect(service.toggle('dump-7x14')).toBeTrue();
    expect(service.isSelected('dump-7x14')).toBeTrue();
    expect(service.slugs()).toEqual(['dump-7x14']);
  });

  it('toggle removes an already-selected trailer', () => {
    service.toggle('a');
    service.toggle('a');
    expect(service.slugs()).toEqual([]);
  });

  it('preserves selection order', () => {
    service.toggle('b');
    service.toggle('a');
    expect(service.slugs()).toEqual(['b', 'a']);
  });

  it('refuses to add beyond the limit and returns false', () => {
    for (let i = 0; i < COMPARE_LIMIT; i++) {
      expect(service.toggle(`trailer-${i}`)).toBeTrue();
    }
    expect(service.isFull()).toBeTrue();
    expect(service.toggle('one-too-many')).toBeFalse();
    expect(service.count()).toBe(COMPARE_LIMIT);
  });

  it('still allows removal via toggle when full', () => {
    for (let i = 0; i < COMPARE_LIMIT; i++) service.toggle(`trailer-${i}`);
    expect(service.toggle('trailer-0')).toBeTrue();
    expect(service.isSelected('trailer-0')).toBeFalse();
    expect(service.count()).toBe(COMPARE_LIMIT - 1);
  });

  it('remove and clear work', () => {
    service.toggle('a');
    service.toggle('b');
    service.remove('a');
    expect(service.slugs()).toEqual(['b']);
    service.clear();
    expect(service.slugs()).toEqual([]);
  });

  it('persists selection to localStorage and restores it', () => {
    service.toggle('a');
    service.toggle('b');
    expect(JSON.parse(localStorage.getItem('vlt-compare')!)).toEqual(['a', 'b']);

    // A fresh service instance (new page load) restores the same selection
    const fresh = new CompareService();
    expect(fresh.slugs()).toEqual(['a', 'b']);
  });

  it('ignores corrupt localStorage data', () => {
    localStorage.setItem('vlt-compare', 'not-json{');
    const fresh = new CompareService();
    expect(fresh.slugs()).toEqual([]);
  });

  it('caps restored data at the limit and drops non-strings', () => {
    localStorage.setItem('vlt-compare', JSON.stringify(['a', 42, 'b', 'c', 'd']));
    const fresh = new CompareService();
    expect(fresh.slugs()).toEqual(['a', 'b', 'c']);
  });
});
