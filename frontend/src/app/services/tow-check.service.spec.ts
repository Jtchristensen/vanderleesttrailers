import { TestBed } from '@angular/core/testing';
import { TowCheckService, VEHICLE_PRESETS } from './tow-check.service';

describe('TowCheckService', () => {
  let service: TowCheckService;

  beforeEach(() => {
    localStorage.removeItem('vlt-tow-vehicle');
    TestBed.configureTestingModule({ providers: [TowCheckService] });
    service = TestBed.inject(TowCheckService);
  });

  afterEach(() => {
    localStorage.removeItem('vlt-tow-vehicle');
  });

  it('starts with no vehicle and check() returns null', () => {
    expect(service.vehicle()).toBeNull();
    expect(service.check('7,000')).toBeNull();
  });

  it('setVehicle stores the vehicle', () => {
    service.setVehicle('Ford F-150', 13500);
    expect(service.vehicle()).toEqual({ name: 'Ford F-150', capacity: 13500 });
  });

  it('rejects invalid vehicles', () => {
    service.setVehicle('', 5000);
    expect(service.vehicle()).toBeNull();
    service.setVehicle('Truck', 0);
    expect(service.vehicle()).toBeNull();
    service.setVehicle('Truck', NaN);
    expect(service.vehicle()).toBeNull();
  });

  it('rates a light trailer as safe (at or below 80% of capacity)', () => {
    service.setVehicle('Ford F-150', 10000);
    const result = service.check('7,999')!;
    expect(result.verdict).toBe('safe');
    expect(result.gvwr).toBe(7999);
    expect(result.capacity).toBe(10000);
  });

  it('rates a near-limit trailer as caution (80–100% of capacity)', () => {
    service.setVehicle('Truck', 10000);
    expect(service.check(9500)!.verdict).toBe('caution');
    expect(service.check(10000)!.verdict).toBe('caution');
  });

  it('rates an overweight trailer as over', () => {
    service.setVehicle('Tacoma', 6800);
    expect(service.check('14,000')!.verdict).toBe('over');
  });

  it('uses the exact 80% boundary for safe', () => {
    service.setVehicle('Truck', 10000);
    expect(service.check(8000)!.verdict).toBe('safe');
    expect(service.check(8001)!.verdict).toBe('caution');
  });

  it('caps the display ratio at 1.5', () => {
    service.setVehicle('Small SUV', 2000);
    expect(service.check(14000)!.ratio).toBe(1.5);
  });

  it('returns null for missing or unparseable GVWR', () => {
    service.setVehicle('Truck', 10000);
    expect(service.check(null)).toBeNull();
    expect(service.check('')).toBeNull();
    expect(service.check('N/A')).toBeNull();
  });

  it('parses weights from strings with commas', () => {
    expect(TowCheckService.parseWeight('14,000')).toBe(14000);
    expect(TowCheckService.parseWeight(9990)).toBe(9990);
    expect(TowCheckService.parseWeight('7,000 lbs')).toBe(7000);
  });

  it('persists the vehicle and restores it on a fresh instance', () => {
    service.setVehicle('Ram 1500', 12750);
    const fresh = new TowCheckService();
    expect(fresh.vehicle()).toEqual({ name: 'Ram 1500', capacity: 12750 });
  });

  it('clear() removes the vehicle and storage', () => {
    service.setVehicle('Ram 1500', 12750);
    service.clear();
    expect(service.vehicle()).toBeNull();
    expect(localStorage.getItem('vlt-tow-vehicle')).toBeNull();
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem('vlt-tow-vehicle', '{bad json');
    const fresh = new TowCheckService();
    expect(fresh.vehicle()).toBeNull();
  });

  it('ships sensible presets', () => {
    expect(VEHICLE_PRESETS.length).toBeGreaterThan(10);
    for (const preset of VEHICLE_PRESETS) {
      expect(preset.name).toBeTruthy();
      expect(preset.capacity).toBeGreaterThan(0);
    }
  });
});
