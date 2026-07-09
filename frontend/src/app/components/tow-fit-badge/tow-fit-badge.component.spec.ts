import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TowFitBadgeComponent } from './tow-fit-badge.component';
import { TowCheckService } from '../../services/tow-check.service';

describe('TowFitBadgeComponent', () => {
  let fixture: ComponentFixture<TowFitBadgeComponent>;
  let towCheck: TowCheckService;

  beforeEach(() => {
    localStorage.removeItem('vlt-tow-vehicle');
    TestBed.configureTestingModule({ imports: [TowFitBadgeComponent] });
    fixture = TestBed.createComponent(TowFitBadgeComponent);
    towCheck = TestBed.inject(TowCheckService);
  });

  afterEach(() => localStorage.removeItem('vlt-tow-vehicle'));

  it('renders nothing when no vehicle is selected', () => {
    fixture.componentInstance.trailer = { gvwr: 7000 };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tow-fit-badge')).toBeNull();
  });

  it('renders a safe badge when the trailer is comfortably under capacity', () => {
    towCheck.setVehicle('Ford F-150', 10000);
    fixture.componentInstance.trailer = { gvwr: 7000 };
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.tow-fit-badge');
    expect(el.classList).toContain('tow-fit-badge--safe');
    expect(el.textContent).toContain('Fits your Ford F-150');
  });

  it('renders a caution badge near the limit', () => {
    towCheck.setVehicle('Truck', 10000);
    fixture.componentInstance.trailer = { gvwr: 9500 };
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.tow-fit-badge');
    expect(el.classList).toContain('tow-fit-badge--caution');
  });

  it('renders an over badge when the trailer exceeds capacity', () => {
    towCheck.setVehicle('Tacoma', 6800);
    fixture.componentInstance.trailer = { gvwr: 14000 };
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.tow-fit-badge');
    expect(el.classList).toContain('tow-fit-badge--over');
  });

  it('renders an unknown badge when the trailer has no GVWR, but a vehicle is set', () => {
    towCheck.setVehicle('Truck', 10000);
    fixture.componentInstance.trailer = {};
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.tow-fit-badge');
    expect(el.classList).toContain('tow-fit-badge--unknown');
  });

  it('uses short generic labels in compact mode, without the vehicle name', () => {
    towCheck.setVehicle('Ford F-250 Super Duty', 20000);
    fixture.componentInstance.compact = true;
    fixture.componentInstance.trailer = { gvwr: 7000 };
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.tow-fit-badge');
    expect(el.textContent.trim()).toBe('Fits');
    expect(el.textContent).not.toContain('Ford');
  });

  it('truncates the label with an ellipsis so long vehicle names cannot overflow a card', () => {
    towCheck.setVehicle('My Extremely Long Custom Truck Name Here', 10000);
    fixture.componentInstance.trailer = { gvwr: 5000 };
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('.tow-fit-badge__label');
    const style = getComputedStyle(label);
    expect(style.textOverflow).toBe('ellipsis');
    expect(style.overflow).toContain('hidden');
    expect(style.whiteSpace).toBe('nowrap');
  });
});
