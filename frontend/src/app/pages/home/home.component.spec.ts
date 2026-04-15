import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';

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
