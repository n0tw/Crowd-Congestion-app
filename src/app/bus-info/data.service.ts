import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private apiUrl = 'https://localhost:4000/station_data';

  constructor(private http: HttpClient) {}

  fetchData(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }

  getDataPolling(): Observable<any> {
    return timer(0, 10000).pipe(  // Poll every 10 seconds
      switchMap(() => this.fetchData())
    );
  }
}
