import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private tokenSubject = new BehaviorSubject<string | null>(null);
  token$ = this.tokenSubject.asObservable();

  constructor() {
    const savedToken = sessionStorage.getItem('azureAuthToken');
    if (savedToken) {
      this.tokenSubject.next(savedToken);
    }
  }

  setToken(token: string) {
    sessionStorage.setItem('azureAuthToken', token);
    this.tokenSubject.next(token);
  }

  clearToken() {
    sessionStorage.removeItem('azureAuthToken');
    this.tokenSubject.next(null);
  }

  getToken(): string | null {
    return this.tokenSubject.value || sessionStorage.getItem('azureAuthToken');
  }

  hasToken(): boolean {
    return !!this.getToken();
  }
}
