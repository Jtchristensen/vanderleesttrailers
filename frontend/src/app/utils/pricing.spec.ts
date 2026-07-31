import { dollars, hasSavings, savings } from './pricing';

describe('pricing', () => {
  describe('dollars', () => {
    it('parses the bare numeric strings live records use', () => {
      expect(dollars('10311')).toBe(10311);
    });

    it('parses the numbers seed/test fixtures use', () => {
      expect(dollars(8495)).toBe(8495);
    });

    it('tolerates a currency-formatted value typed into the admin form', () => {
      expect(dollars('$15,900')).toBe(15900);
    });

    it('returns null for blank, missing, and non-numeric values', () => {
      expect(dollars('')).toBeNull();
      expect(dollars(null)).toBeNull();
      expect(dollars(undefined)).toBeNull();
      expect(dollars('call us')).toBeNull();
    });
  });

  describe('savings', () => {
    it('reports the difference when MSRP is above the selling price', () => {
      expect(savings({ price: '8950', msrp: '9995' })).toBe(1045);
    });

    it('is null when the trailer has no MSRP — the overwhelmingly common case', () => {
      expect(savings({ price: '8950' })).toBeNull();
      expect(savings({ price: '8950', msrp: '' })).toBeNull();
    });

    it('is null when MSRP is at or below the selling price, so no badge renders', () => {
      expect(savings({ price: '8950', msrp: '8950' })).toBeNull();
      expect(savings({ price: '8950', msrp: '7000' })).toBeNull();
    });

    it('is null when there is no selling price, even with an MSRP set', () => {
      expect(savings({ price: '', msrp: '9995' })).toBeNull();
    });

    it('handles a missing trailer without throwing', () => {
      expect(savings(null)).toBeNull();
      expect(savings(undefined)).toBeNull();
    });
  });

  describe('hasSavings', () => {
    it('mirrors savings as a boolean for template conditionals', () => {
      expect(hasSavings({ price: '8950', msrp: '9995' })).toBe(true);
      expect(hasSavings({ price: '8950' })).toBe(false);
    });
  });
});
