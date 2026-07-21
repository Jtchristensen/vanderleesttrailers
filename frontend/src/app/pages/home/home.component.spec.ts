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
});

describe('HomeComponent trailer count', () => {
  function createFixture(trailers: any[]): ComponentFixture<HomeComponent> {
    const contentServiceStub = jasmine.createSpyObj<ContentService>('ContentService', [
      'getContent',
      'getGoogleReviews',
      'getTrailers',
    ]);
    contentServiceStub.getContent.and.resolveTo({});
    contentServiceStub.getGoogleReviews.and.resolveTo({
      rating: 5,
      userRatingCount: null,
      googleMapsUri: '',
      openNow: null,
      hours: [],
      links: { directions: '', writeReview: '', reviews: '', photos: '' },
      reviews: [],
    });
    contentServiceStub.getTrailers.and.resolveTo(trailers);

    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), { provide: ContentService, useValue: contentServiceStub }],
    });
    return TestBed.createComponent(HomeComponent);
  }

  it('sets trailerCount to the live inventory length once loaded', async () => {
    const fixture = createFixture([{}, {}, {}]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.trailerCount).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('3');
  });

  it('falls back to "100+" when the trailer fetch resolves empty', async () => {
    const fixture = createFixture([]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.trailerCount).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('100+');
  });
});
