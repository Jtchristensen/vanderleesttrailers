import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { ContentService } from '../../services/content.service';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HomeComponent);
  });

  it('renders without throwing against sync-fallback content', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('seeds categories, brands, services, reviews as arrays (template iteration safe)', () => {
    const c = fixture.componentInstance;
    expect(Array.isArray(c.categories)).toBeTrue();
    expect(Array.isArray(c.brands)).toBeTrue();
    expect(Array.isArray(c.services)).toBeTrue();
    expect(Array.isArray(c.reviews)).toBeTrue();
  });

  it('sets trailerCount to the live inventory length once loaded', async () => {
    const contentService = TestBed.inject(ContentService);
    spyOn(contentService, 'getTrailers').and.resolveTo([{}, {}, {}]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.trailerCount).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('3');
  });

  it('falls back to "100+" when the trailer fetch resolves empty', async () => {
    const contentService = TestBed.inject(ContentService);
    spyOn(contentService, 'getTrailers').and.resolveTo([]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.trailerCount).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('100+');
  });
});
