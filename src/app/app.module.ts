import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { GoogleMapsModule } from '@angular/google-maps'; 
import { MatMomentDateModule, MAT_MOMENT_DATE_ADAPTER_OPTIONS } from '@angular/material-moment-adapter';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';  
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { BusInfoComponent } from './bus-info/bus-info.component';
import { CongestionComponent } from './congestion/congestion.component';
import { MenuComponent } from './menu/menu.component';
import { HttpClientModule } from '@angular/common/http';
import { EnvInfoComponent } from './env-info/env-info.component';
import { AuthentComponent } from './authent/authent.component';
import { MainComponent } from './main/main.component';
import { CldrDialogComponent } from './cldr-dialog/cldr-dialog.component';
import { ExceldataComponent } from './exceldata/exceldata.component';
import { InfoWindowContentComponent } from './info-window-content/info-window-content.component';

import { MatButtonModule } from '@angular/material/button';
import { MsalModule, MsalService, MSAL_INSTANCE, MSAL_GUARD_CONFIG,MsalGuard, MsalBroadcastService, MsalGuardConfiguration, MsalInterceptorConfiguration } from '@azure/msal-angular';
import { PublicClientApplication, InteractionType } from '@azure/msal-browser';
import { FormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export function MSALInstanceFactory(): PublicClientApplication{
  return new PublicClientApplication({
    auth: {
      clientId: '03484339-0a04-4715-9fed-3070e2920136', // Application (client) ID from Azure
      authority: 'https://login.microsoftonline.com/5a52ab58-42d0-4bb4-b3fc-713dd6822d20', // Your tenant ID
      redirectUri: 'https://192.168.1.4:4200/main', // Redirect URI registered in Azure
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: true,
    },
  });
}
  
  export function MSALGuardConfigFactory(): MsalGuardConfiguration {
    return {
      interactionType: InteractionType.Popup, // Use Redirect for login
      authRequest: {
        scopes: ['User.Read'], // Add any scopes you need
      },
    };
  }
  
  
  // Configure MSAL Interceptor (for protecting API requests)
  export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
    const protectedResourceMap = new Map<string, Array<string>>();
    protectedResourceMap.set('https://graph.microsoft.com/v1.0/me', ['User.Read']); // Add other resources if necessary
  
    return {
      interactionType: InteractionType.Redirect, // Use Redirect for API requests
      protectedResourceMap,
    };
  }
  export function initializeMsalInstance(msalInstance: PublicClientApplication) {
    return () => msalInstance.initialize();  // Async initialization of the MSAL instance
  }

  const routes: Routes = [
    { path: 'login', component: AuthentComponent },
    { path: 'main', component: MainComponent, canActivate: [MsalGuard]  },
    { path: '', redirectTo: '/login', pathMatch: 'full' } // Default route
  ];

  const routes1: Routes = [
    { path: '', component: CldrDialogComponent }, // Add route for main page
    { path: 'main', component: MainComponent }, // The route for Google redirect URI
    { path: '', redirectTo: '/main', pathMatch: 'full' }, // Default route
  ];
@NgModule({
  declarations: [
    AppComponent,
    AuthentComponent,
    CldrDialogComponent,
    MainComponent,
    CongestionComponent,
    EnvInfoComponent,
    ExceldataComponent,
    
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(routes),
    RouterModule.forRoot(routes1),
    GoogleMapsModule,
    MatTableModule,
    MatButtonModule,
    MatDialogModule,
    MenuComponent,
    BusInfoComponent,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMomentDateModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    InfoWindowContentComponent,
    /* RouterModule.forRoot([
      { path: 'login', component: AuthentComponent },
      { path: 'main', component: MainComponent },
      { path: '', redirectTo: '/login', pathMatch: 'full' }
    ]), */
    RouterModule.forRoot([{ path: '', component: AppComponent }]),
    MsalModule.forRoot(
        MSALInstanceFactory(),
        MSALGuardConfigFactory(),  // Pass the guard configuration
        MSALInterceptorConfigFactory() // Pass the interceptor configuration
      )
  ],
  providers: [
    {
      provide: MSAL_INSTANCE,
      useFactory: MSALInstanceFactory,
    },
    {
      provide: MSAL_GUARD_CONFIG,
      useFactory: MSALGuardConfigFactory
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeMsalInstance,
      deps: [MSAL_INSTANCE],
      multi: true,  // Ensures this function is run before the app is initialized
    },
      MsalService,
      MsalGuard,
      MsalBroadcastService,
      provideAnimationsAsync(),
    ],
  bootstrap: [AppComponent]
})
export class AppModule { }
