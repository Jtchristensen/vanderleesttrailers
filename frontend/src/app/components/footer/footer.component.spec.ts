import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(FooterComponent);
  });

  it('renders without throwing against sync-fallback site data', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('uses optional chaining when site.social is absent (regression guard)', () => {
    // Force site to an empty object — simulates an API response that lacks the
    // social block. Before the fix, this threw "Cannot read properties of
    // undefined (reading 'facebook')" on first render.
    fixture.componentInstance.site = {};
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
