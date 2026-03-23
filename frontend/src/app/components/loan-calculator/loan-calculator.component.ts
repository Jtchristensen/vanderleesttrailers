import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-loan-calculator',
    imports: [CommonModule, FormsModule],
    templateUrl: './loan-calculator.component.html',
    styleUrls: ['./loan-calculator.component.scss']
})
export class LoanCalculatorComponent implements OnInit {
  @Input() price: number = 0;

  vehiclePrice: number = 0;
  downPayment: number = 0;
  interestRate: number = 6.9;
  loanTerm: number = 60;

  termOptions = [24, 36, 48, 60, 72, 84];

  monthlyPayment: number = 0;
  totalPayment: number = 0;
  totalInterest: number = 0;

  ngOnInit() {
    if (this.price > 0) {
      this.vehiclePrice = this.price;
    }
    this.calculate();
  }

  calculate() {
    const principal = this.vehiclePrice - this.downPayment;

    if (principal <= 0 || this.loanTerm <= 0) {
      this.monthlyPayment = 0;
      this.totalPayment = 0;
      this.totalInterest = 0;
      return;
    }

    if (this.interestRate === 0) {
      this.monthlyPayment = principal / this.loanTerm;
      this.totalPayment = principal;
      this.totalInterest = 0;
      return;
    }

    const monthlyRate = this.interestRate / 100 / 12;
    const n = this.loanTerm;

    this.monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) /
      (Math.pow(1 + monthlyRate, n) - 1);

    this.totalPayment = this.monthlyPayment * n;
    this.totalInterest = this.totalPayment - principal;
  }
}
