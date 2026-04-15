import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FinancingComponent } from './financing.component';

describe('FinancingComponent', () => {
  let fixture: ComponentFixture<FinancingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancingComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(FinancingComponent);
  });

  it('renders without throwing against sync-fallback content', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('seeds content from sync fallback so hero block is present on first render', () => {
    // Regression guard: the class of crashes was "undefined.heading/backgroundImage".
    // The fix is to guarantee content.hero exists from field-init time.
    expect(fixture.componentInstance.content.hero).toBeDefined();
    expect(fixture.componentInstance.content.hero.heading).toBeTruthy();
  });
});
