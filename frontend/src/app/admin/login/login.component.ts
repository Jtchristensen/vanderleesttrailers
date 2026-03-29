import { Component } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-admin-login',
    imports: [FormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class AdminLoginComponent {
  view: 'login' | 'forgot' | 'reset' = 'login';
  email = '';
  password = '';
  code = '';
  newPassword = '';
  confirmNewPassword = '';
  error = '';
  success = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  async onSubmit() {
    this.loading = true;
    this.error = '';
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/admin']);
    } catch (err: any) {
      this.error = err.message || 'Login failed. Please check your credentials.';
    } finally {
      this.loading = false;
    }
  }

  async onForgotSubmit() {
    this.loading = true;
    this.error = '';
    this.success = '';
    try {
      await this.auth.forgotPassword(this.email);
      this.view = 'reset';
      this.success = 'A verification code has been sent to your email.';
    } catch (err: any) {
      this.error = err.message || 'Could not send reset code. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async onResetSubmit() {
    this.error = '';
    this.success = '';

    if (this.newPassword !== this.confirmNewPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    try {
      await this.auth.confirmPassword(this.email, this.code, this.newPassword);
      this.view = 'login';
      this.success = 'Password reset successfully. You can now sign in.';
      this.code = '';
      this.newPassword = '';
      this.confirmNewPassword = '';
    } catch (err: any) {
      this.error = err.message || 'Could not reset password. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  showForgot() {
    this.view = 'forgot';
    this.error = '';
    this.success = '';
  }

  backToLogin() {
    this.view = 'login';
    this.error = '';
    this.success = '';
  }
}
