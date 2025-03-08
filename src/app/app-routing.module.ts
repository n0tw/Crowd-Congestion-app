import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthentComponent } from './authent/authent.component';
import { MainComponent } from './main/main.component';
import { MsalGuard } from '@azure/msal-angular';  // Import MsalGuard

const routes: Routes = [
  { path: 'login', component: AuthentComponent },
  { path: 'main', component: MainComponent, canActivate: [MsalGuard] },  // Protect this route with MsalGuard
  { path: '', redirectTo: '/login', pathMatch: 'full' },  // Default route
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
