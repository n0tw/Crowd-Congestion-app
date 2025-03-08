import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class GoogleTokenService {
    private GoogleToken = new BehaviorSubject<string | null>(null);
    tokenG$ = this.GoogleToken.asObservable();

    constructor() {
        const savedToken  = sessionStorage.getItem('googleAuthToken');
        if (savedToken) {
        this.GoogleToken.next(savedToken);
        }
    }

    setToken(token: string) {
        sessionStorage.removeItem('authToken'); // Ensure no old token
        sessionStorage.setItem('authToken', token); 
        this.GoogleToken.next(token); 
    }
    

    clearToken() {
        sessionStorage.removeItem('authToken');
        this.GoogleToken.next(null);
    }

    getToken(): string | null {
        return this.GoogleToken.value || sessionStorage.getItem('authToken');
    }

    hasToken(): boolean {
        return !!this.getToken();
    }
}
