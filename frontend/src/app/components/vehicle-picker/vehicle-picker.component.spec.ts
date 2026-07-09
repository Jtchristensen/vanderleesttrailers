import { TestBed, ComponentFixture } from '@angular/core/testing';
import { VehiclePickerComponent } from './vehicle-picker.component';
import { TowCheckService } from '../../services/tow-check.service';

describe('VehiclePickerComponent', () => {
  let fixture: ComponentFixture<VehiclePickerComponent>;
  let towCheck: TowCheckService;

  beforeEach(() => {
    localStorage.removeItem('vlt-tow-vehicle');
    TestBed.configureTestingModule({ imports: [VehiclePickerComponent] });
    fixture = TestBed.createComponent(VehiclePickerComponent);
    towCheck = TestBed.inject(TowCheckService);
  });

  afterEach(() => localStorage.removeItem('vlt-tow-vehicle'));

  it('starts with no preset selected when there is no saved vehicle', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedPreset).toBe('');
    expect(fixture.componentInstance.canApply).toBeFalse();
  });

  it('preselects the matching preset when a vehicle is already saved', () => {
    towCheck.setVehicle('Ford F-150', 13500);
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedPreset).toBe('Ford F-150');
  });

  it('preselects "custom" and fills in the fields for a non-preset saved vehicle', () => {
    towCheck.setVehicle('My Old Truck', 9000);
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedPreset).toBe('custom');
    expect(fixture.componentInstance.customName).toBe('My Old Truck');
    expect(fixture.componentInstance.customCapacity).toBe(9000);
  });

  it('applying a preset saves the vehicle and emits applied', () => {
    fixture.detectChanges();
    const applied = jasmine.createSpy('applied');
    fixture.componentInstance.applied.subscribe(applied);

    fixture.componentInstance.selectedPreset = 'Ford F-150';
    fixture.componentInstance.apply();

    expect(towCheck.vehicle()).toEqual({ name: 'Ford F-150', capacity: 13500 });
    expect(applied).toHaveBeenCalled();
  });

  it('custom entry requires a positive capacity before it can apply', () => {
    fixture.detectChanges();
    fixture.componentInstance.selectedPreset = 'custom';
    expect(fixture.componentInstance.canApply).toBeFalse();

    fixture.componentInstance.customCapacity = 0;
    expect(fixture.componentInstance.canApply).toBeFalse();

    fixture.componentInstance.customCapacity = 9500;
    expect(fixture.componentInstance.canApply).toBeTrue();

    fixture.componentInstance.customName = 'Trail Rig';
    fixture.componentInstance.apply();
    expect(towCheck.vehicle()).toEqual({ name: 'Trail Rig', capacity: 9500 });
  });

  it('apply() no-ops when the form is not valid', () => {
    fixture.detectChanges();
    fixture.componentInstance.apply();
    expect(towCheck.vehicle()).toBeNull();
  });
});
