import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'vlt-tow-vehicle';

export interface TowVehicle {
  name: string;
  /** Maximum towing capacity in lbs */
  capacity: number;
}

export type TowVerdict = 'safe' | 'caution' | 'over';

export interface TowResult {
  verdict: TowVerdict;
  /** Trailer GVWR as a fraction of the vehicle's towing capacity (0–1+, capped at 1.5 for display) */
  ratio: number;
  gvwr: number;
  capacity: number;
}

/**
 * Common tow vehicles with typical MAX conventional towing capacity (lbs).
 * Real capacity varies by cab/bed/engine/package — the UI carries a
 * "verify against your owner's manual" disclaimer.
 */
export const VEHICLE_PRESETS: TowVehicle[] = [
  { name: 'Ford F-150', capacity: 13500 },
  { name: 'Ford F-250 Super Duty', capacity: 20000 },
  { name: 'Ford Ranger', capacity: 7500 },
  { name: 'Ford Explorer', capacity: 5600 },
  { name: 'Ford Expedition', capacity: 9600 },
  { name: 'Chevy Silverado 1500', capacity: 13300 },
  { name: 'Chevy Silverado 2500HD', capacity: 18500 },
  { name: 'Chevy Colorado', capacity: 7700 },
  { name: 'Chevy Tahoe', capacity: 8400 },
  { name: 'GMC Sierra 1500', capacity: 13200 },
  { name: 'Ram 1500', capacity: 12750 },
  { name: 'Ram 2500', capacity: 15000 },
  { name: 'Toyota Tundra', capacity: 12000 },
  { name: 'Toyota Tacoma', capacity: 6800 },
  { name: 'Jeep Grand Cherokee', capacity: 7200 },
  { name: 'Honda Ridgeline', capacity: 5000 },
];

/** Below this fraction of capacity we call it a comfortable match (the "80% rule"). */
export const SAFE_RATIO = 0.8;

@Injectable({ providedIn: 'root' })
export class TowCheckService {
  private vehicleSignal = signal<TowVehicle | null>(this.load());

  /** The shopper's tow vehicle, persisted on this device. */
  readonly vehicle = this.vehicleSignal.asReadonly();

  setVehicle(name: string, capacity: number) {
    if (!name || !isFinite(capacity) || capacity <= 0) return;
    const vehicle = { name: name.trim(), capacity: Math.round(capacity) };
    this.vehicleSignal.set(vehicle);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicle));
    } catch {
      // Storage unavailable — selection still works in-memory
    }
  }

  clear() {
    this.vehicleSignal.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  /**
   * Rate the current vehicle against a trailer's GVWR (worst case: trailer
   * loaded to its rated maximum). Returns null when either side is unknown.
   */
  check(gvwr: unknown): TowResult | null {
    const vehicle = this.vehicleSignal();
    const gvwrNum = TowCheckService.parseWeight(gvwr);
    if (!vehicle || gvwrNum === null) return null;

    const ratio = gvwrNum / vehicle.capacity;
    const verdict: TowVerdict = ratio <= SAFE_RATIO ? 'safe' : ratio <= 1 ? 'caution' : 'over';
    return {
      verdict,
      ratio: Math.min(ratio, 1.5),
      gvwr: gvwrNum,
      capacity: vehicle.capacity,
    };
  }

  /** Parse weights that may arrive as numbers or strings like "14,000". */
  static parseWeight(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const digits = String(value).replace(/[^0-9.]/g, '');
    if (!digits) return null;
    const n = parseFloat(digits);
    return isNaN(n) || n <= 0 ? null : n;
  }

  private load(): TowVehicle | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string' && typeof parsed.capacity === 'number' && parsed.capacity > 0) {
        return { name: parsed.name, capacity: parsed.capacity };
      }
      return null;
    } catch {
      return null;
    }
  }
}
