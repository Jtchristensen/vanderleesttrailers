import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TrailerDetailComponent } from './trailer-detail.component';

describe('TrailerDetailComponent', () => {
  let fixture: ComponentFixture<TrailerDetailComponent>;
  let component: TrailerDetailComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrailerDetailComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TrailerDetailComponent);
    component = fixture.componentInstance;
    component.trailer = { name: 'Test', images: ['/a.jpg', '/b.jpg', '/c.jpg'] };
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  describe('image navigation', () => {
    it('advances to the next image and wraps from last to first', () => {
      component.activeImage = 0;
      component.nextImage();
      expect(component.activeImage).toBe(1);
      component.activeImage = 2;
      component.nextImage();
      expect(component.activeImage).toBe(0);
    });

    it('rewinds to the previous image and wraps from first to last', () => {
      component.activeImage = 1;
      component.prevImage();
      expect(component.activeImage).toBe(0);
      component.activeImage = 0;
      component.prevImage();
      expect(component.activeImage).toBe(2);
    });

    it('is a no-op when there are no images', () => {
      component.trailer = { name: 'None', images: [] };
      component.activeImage = 0;
      component.nextImage();
      expect(component.activeImage).toBe(0);
    });
  });

  describe('lightbox', () => {
    it('opens the lightbox and locks body scroll', () => {
      component.openLightbox();
      expect(component.lightboxOpen).toBeTrue();
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('refuses to open when the trailer has no images', () => {
      component.trailer = { name: 'None', images: [] };
      component.openLightbox();
      expect(component.lightboxOpen).toBeFalse();
      expect(document.body.style.overflow).toBe('');
    });

    it('closes the lightbox and restores body scroll', () => {
      component.openLightbox();
      component.closeLightbox();
      expect(component.lightboxOpen).toBeFalse();
      expect(document.body.style.overflow).toBe('');
    });

    it('Escape closes the lightbox when open', () => {
      component.openLightbox();
      component.onKey(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(component.lightboxOpen).toBeFalse();
    });

    it('ArrowRight/ArrowLeft navigate when the lightbox is open', () => {
      component.activeImage = 0;
      component.openLightbox();
      component.onKey(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(component.activeImage).toBe(1);
      component.onKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(component.activeImage).toBe(0);
    });

    it('ignores keys when the lightbox is closed', () => {
      component.activeImage = 0;
      component.lightboxOpen = false;
      component.onKey(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(component.activeImage).toBe(0);
    });
  });
});
