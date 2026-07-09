import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TowFitBarComponent } from './tow-fit-bar.component';
import { TowCheckService } from '../../services/tow-check.service';

describe('TowFitBarComponent', () => {
  let fixture: ComponentFixture<TowFitBarComponent>;
  let towCheck: TowCheckService;

  beforeEach(() => {
    localStorage.removeItem('vlt-tow-vehicle');
    TestBed.configureTestingModule({ imports: [TowFitBarComponent] });
    fixture = TestBed.createComponent(TowFitBarComponent);
    towCheck = TestBed.inject(TowCheckService);
  });

  afterEach(() => localStorage.removeItem('vlt-tow-vehicle'));

  it('shows the vehicle picker when no vehicle is selected', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-vehicle-picker')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.tow-fit-bar__toggle')).toBeNull();
  });

  it('shows the vehicle chip and filter toggle once a vehicle is saved', () => {
    towCheck.setVehicle('Ford F-150', 13500);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Ford F-150');
    expect(el.textContent).toContain('13,500 lbs');
    expect(el.querySelector('.tow-fit-bar__toggle')).not.toBeNull();
  });

  it('emits the flipped value when the filter toggle is clicked', () => {
    towCheck.setVehicle('Ford F-150', 13500);
    fixture.componentInstance.filterOnlyTowable = false;
    fixture.detectChanges();

    const emitted: boolean[] = [];
    fixture.componentInstance.filterOnlyTowableChange.subscribe((v: boolean) => emitted.push(v));

    (fixture.nativeElement.querySelector('.tow-fit-bar__toggle') as HTMLElement).click();
    expect(emitted).toEqual([true]);
  });

  it('shows a "Showing X of Y" summary only while actively filtering', () => {
    towCheck.setVehicle('Ford F-150', 13500);
    fixture.componentInstance.filterOnlyTowable = true;
    fixture.componentInstance.shownCount = 5;
    fixture.componentInstance.totalCount = 12;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Showing 5 of 12');
  });

  it('does not show the summary when the counts are equal (nothing filtered out)', () => {
    towCheck.setVehicle('Ford F-150', 13500);
    fixture.componentInstance.filterOnlyTowable = true;
    fixture.componentInstance.shownCount = 12;
    fixture.componentInstance.totalCount = 12;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tow-fit-bar__count')).toBeNull();
  });

  it('clearVehicle clears the saved vehicle and emits filter off', () => {
    towCheck.setVehicle('Ford F-150', 13500);
    fixture.detectChanges();

    const emitted: boolean[] = [];
    fixture.componentInstance.filterOnlyTowableChange.subscribe((v: boolean) => emitted.push(v));

    fixture.componentInstance.clearVehicle();
    expect(towCheck.vehicle()).toBeNull();
    expect(emitted).toEqual([false]);
  });
});
