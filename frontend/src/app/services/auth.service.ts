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
  private userPool: CognitoUserPool;

  constructor() {
    this.userPool = new CognitoUserPool({
      UserPoolId: environment.userPoolId,
      ClientId: environment.userPoolClientId,
    });
  }

  login(email: string, password: string): Promise<CognitoUserSession> {
    const user = new CognitoUser({ Username: email, Pool: this.userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    return new Promise((resolve, reject) => {
      user.authenticateUser(authDetails, {
        onSuccess: (session) => resolve(session),
        onFailure: (err) => reject(err),
        newPasswordRequired: (userAttributes) => {
          // First-time login — force password change
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
    const user = this.userPool.getCurrentUser();
    if (user) user.signOut();
  }

  getSession(): Promise<CognitoUserSession | null> {
    const user = this.userPool.getCurrentUser();
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
