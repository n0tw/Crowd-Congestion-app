import { Component, OnInit } from '@angular/core';
import { MatDialogRef} from '@angular/material/dialog';
import { GoogleTokenService } from './googletoken.service';
declare var google: any;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}
@Component({
  selector: 'app-cldr-dialog',
  templateUrl: './cldr-dialog.component.html',
  styleUrls: ['./cldr-dialog.component.css']
})
export class CldrDialogComponent implements OnInit {
  tokenClient: any = null;  
  client_id: string = '260243600706-e5u8mdaiap2q54eo9frj7r40lnjnq2ro.apps.googleusercontent.com';
  
  constructor(
    private googleTokenService: GoogleTokenService,
    public dialogRef: MatDialogRef<CldrDialogComponent>,
  ) {}
  closeDialog(): void {
    this.dialogRef.close(false);
  }

  ngOnInit(): void {
    if (typeof google !== 'undefined' && google.accounts) {
      this.initializeGisClient();
    } else {
      console.error('Google API script not loaded.');
    }
  }
  

  initializeGisClient(): void {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.client_id,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      callback: async (response: any) => {
        if (response.error) {
          console.error('Error during token acquisition:', response.error);
          return;
        }

        if (response.access_token) {
          this.googleTokenService.setToken(response.access_token);
        } else {
          console.error('No access token received.');
        }
      },
    });
  }
    

  async requestAccessToken(): Promise<void> {
    if (this.tokenClient) {
      try {
        await this.tokenClient.requestAccessToken();
        this.closeDialog();
      } catch (error) {
        console.error("Error requesting access token:", error);
      }
    } else {
      console.error("Token client not initialized.");
    }
  }
  
}

  