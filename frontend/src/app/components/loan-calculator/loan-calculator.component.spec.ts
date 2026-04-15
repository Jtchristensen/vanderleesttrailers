import { TestBed } from '@angular/core/testing';
import { LoanCalculatorComponent } from './loan-calculator.component';

describe('LoanCalculatorComponent', () => {
  let component: LoanCalculatorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanCalculatorComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(LoanCalculatorComponent);
    component = fixture.componentInstance;
  });

  it('produces the standard amortization payment for a typical loan', () => {
    component.vehiclePrice = 10000;
    component.downPayment = 0;
    component.interestRate = 6.9;
    component.loanTerm = 60;
    component.calculate();
    // Closed-form amortization: principal=10000, r=0.00575, n=60 → ≈ 197.54
    expect(component.monthlyPayment).toBeCloseTo(197.54, 1);
    expect(component.totalPayment).toBeCloseTo(component.monthlyPayment * 60, 5);
    expect(component.totalInterest).toBeCloseTo(component.totalPayment - 10000, 5);
  });

  it('splits principal evenly when interest is zero', () => {
    component.vehiclePrice = 12000;
    component.downPayment = 0;
    component.interestRate = 0;
    component.loanTerm = 24;
    component.calculate();
    expect(component.monthlyPayment).toBe(500);
    expect(component.totalInterest).toBe(0);
    expect(component.totalPayment).toBe(12000);
  });

  it('subtracts down payment from principal before computing', () => {
    component.vehiclePrice = 10000;
    component.downPayment = 2000;
    component.interestRate = 0;
    component.loanTerm = 40;
    component.calculate();
    expect(component.monthlyPayment).toBe(200); // 8000 / 40
  });

  it('zeros out when principal is non-positive (down payment ≥ price)', () => {
    component.vehiclePrice = 5000;
    component.downPayment = 5000;
    component.interestRate = 6.9;
    component.loanTerm = 60;
    component.calculate();
    expect(component.monthlyPayment).toBe(0);
    expect(component.totalPayment).toBe(0);
    expect(component.totalInterest).toBe(0);
  });

  it('zeros out when loan term is zero', () => {
    component.vehiclePrice = 10000;
    component.downPayment = 0;
    component.interestRate = 6.9;
    component.loanTerm = 0;
    component.calculate();
    expect(component.monthlyPayment).toBe(0);
  });

  it('pre-fills vehicle price from the price input on init', () => {
    component.price = 15000;
    component.ngOnInit();
    expect(component.vehiclePrice).toBe(15000);
  });

  it('leaves vehicle price alone when price input is zero', () => {
    component.price = 0;
    component.vehiclePrice = 8000;
    component.ngOnInit();
    expect(component.vehiclePrice).toBe(8000);
  });
});
