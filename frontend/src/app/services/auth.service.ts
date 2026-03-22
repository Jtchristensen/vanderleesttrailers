import { Injectable } from '@angular/core';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userPool: CognitoUserPool | null = null;

  private getPool(): CognitoUserPool {
    if (!this.userPool) {
      this.userPool = new CognitoUserPool({
        UserPoolId: environment.userPoolId,
        ClientId: environment.userPoolClientId,
      });
    }
    return this.userPool;
  }

  login(email: string, password: string): Promise<CognitoUserSession> {
    const pool = this.getPool();
    const user = new CognitoUser({ Username: email, Pool: pool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    return new Promise((resolve, reject) => {
      user.authenticateUser(authDetails, {
        onSuccess: (session) => resolve(session),
        onFailure: (err) => reject(err),
        newPasswordRequired: (userAttributes) => {
          delete userAttributes.email_verified;
          delete userAttributes.email;
          user.completeNewPasswordChallenge(password, userAttributes, {
            onSuccess: (session) => resolve(session),
            onFailure: (err) => reject(err),
          });
        },
      });
    });
  }

  logout() {
    try {
      const user = this.getPool().getCurrentUser();
      if (user) user.signOut();
    } catch {
      // Pool not configured — nothing to do
    }
  }

  getSession(): Promise<CognitoUserSession | null> {
    try {
      const user = this.getPool().getCurrentUser();
      if (!user) return Promise.resolve(null);

      return new Promise((resolve) => {
        user.getSession((err: any, session: CognitoUserSession | null) => {
          if (err || !session?.isValid()) {
            resolve(null);
          } else {
            resolve(session);
          }
        });
      });
    } catch {
      return Promise.resolve(null);
    }
  }

  async getToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.getIdToken().getJwtToken() || null;
  }

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session?.isValid() || false;
  }
}
