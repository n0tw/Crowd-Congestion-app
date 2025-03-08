import { Component } from '@angular/core';
import { UserService } from './user.service';
import { MsalService } from '@azure/msal-angular';
import { Router } from '@angular/router';
import {  AuthenticationResult } from '@azure/msal-browser';


@Component({
  selector: 'app-authent',
  templateUrl: './authent.component.html',
  styleUrl: './authent.component.css'
})
export class AuthentComponent {
  userRole: string = '';
  username: string = '';
  password: string = '';
  
  constructor( private router: Router,private userService: UserService, private msalService: MsalService) {}

  ngOnInit(): void {
  }

  isLoggedIn(): boolean{
    return this.msalService.instance.getActiveAccount != null
  }
  login() {
    this.msalService.loginPopup({
      scopes: ['User.Read'],  // Provide necessary scopes
      redirectUri: 'https://localhost:4200/main'  // Redirect to the main page after login
    }).subscribe((response: AuthenticationResult) => {
      console.log("response.idToken",response.idToken, response.accessToken);
      this.userService.setToken(response.idToken);
      this.msalService.instance.setActiveAccount(response.account);
      this.router.navigate(['/main']);
    });
  }
  

  logout(){
    this.userService.clearToken(); 
    this.msalService.logout();
  }
}
