import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let component: HeaderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders without throwing against sync-fallback site data', () => {
    // Regression guard: the class of crashes we fixed lived in the pre-load window.
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component.site).toBeTruthy();
    expect(component.site.name).toBeDefined();
  });

  describe('toggleMobileMenu', () => {
    it('flips the open flag and locks body scroll when opened', () => {
      expect(component.isMobileMenuOpen).toBeFalse();
      component.toggleMobileMenu();
      expect(component.isMobileMenuOpen).toBeTrue();
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll on close', () => {
      component.toggleMobileMenu();
      component.toggleMobileMenu();
      expect(component.isMobileMenuOpen).toBeFalse();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('closeMobileMenu', () => {
    it('forces the menu closed and restores body scroll', () => {
      component.toggleMobileMenu();
      component.closeMobileMenu();
      expect(component.isMobileMenuOpen).toBeFalse();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('toggleDropdown', () => {
    it('opens a dropdown by label', () => {
      component.toggleDropdown('Inventory');
      expect(component.activeDropdown).toBe('Inventory');
    });

    it('closes the active dropdown when toggled with the same label', () => {
      component.toggleDropdown('Inventory');
      component.toggleDropdown('Inventory');
      expect(component.activeDropdown).toBeNull();
    });

    it('switches to a different dropdown when toggled with a new label', () => {
      component.toggleDropdown('Inventory');
      component.toggleDropdown('Services');
      expect(component.activeDropdown).toBe('Services');
    });
  });

  describe('onScroll', () => {
    it('flips isScrolled when scrollY crosses the threshold', () => {
      spyOnProperty(window, 'scrollY').and.returnValue(0);
      component.onScroll();
      expect(component.isScrolled).toBeFalse();
    });

    it('flips isScrolled true past 50px', () => {
      spyOnProperty(window, 'scrollY').and.returnValue(100);
      component.onScroll();
      expect(component.isScrolled).toBeTrue();
    });
  });
});
