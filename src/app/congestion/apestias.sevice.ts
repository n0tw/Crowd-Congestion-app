import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders  } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UserService } from '../authent/user.service'; 


@Injectable({
  providedIn: 'root'
})
export class SpotDataService {

  private apiUrl = 'https://localhost:5000/api/spot-data'; 

  constructor(private http: HttpClient, private userService: UserService) { }

  getSpotData(): Observable<any> {
    const token = this.userService.getToken();

    if (!token) {
      console.error('No token available. Unauthorized request.');
      return throwError(() => new Error('Unauthorized request: Token is missing'));
    }

    const headers = new HttpHeaders()
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json');

    return this.http.get<any>(this.apiUrl, { headers:headers }).pipe(
      catchError((error) => {
        console.error('Error fetching spot data:', error);
        return throwError(() => error);
      })
    );
  }
}
