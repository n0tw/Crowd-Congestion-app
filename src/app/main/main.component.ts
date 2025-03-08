import { Component, OnInit, HostListener } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { MatDialog} from '@angular/material/dialog';
import { CldrDialogComponent } from '../cldr-dialog/cldr-dialog.component';
import { UserService } from '../authent/user.service';
import { HttpHeaders } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';
import { jwtDecode } from 'jwt-decode';
import { Router } from '@angular/router';
import * as CryptoJS from 'crypto-js';

async function requestLocationPermission() {
  const permission = await Geolocation.requestPermissions();
  if (permission.location === 'granted') {
    console.log('Location permission granted');
    return true;
  } else {
    console.log('Location permission denied');
    return false;
  }
}

async function getDeviceId() {
  const info = await Device.getId();
  return info.identifier
}
declare var wifi: any;
@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrl: './main.component.css'
})
export class MainComponent implements OnInit {
  previous_location: number[] | null = null;
  title = 'angthesis';
  currentCoords: GeolocationPosition | null = null;
  activeTab: string = 'businfo';
  tabsLoaded = false;
  token: string | null = null;
  headers: Record<string, string> = {};
  menuCollapsed: boolean = true;

  toggleMenu() {
    this.menuCollapsed = !this.menuCollapsed;
  }

  closeMenu() {
    this.menuCollapsed = true;
  }
  @HostListener('window:resize', ['$event'])
  onResize(event:any) {
    if (window.innerWidth >= 590) {
      this.menuCollapsed = true;
    }
  }

  public location!: { lat: number, lng: number; accuracy:number, speed?: number } ;
  constructor(
    private userService: UserService, 
    private dialog: MatDialog,
    private msalService: MsalService,
    private router: Router
  ) {}

  async getsecretstring():Promise<string | null>{
    let response = await  fetch('https://localhost:5000/secretString', {
      method: 'POST',
      headers: this.headers,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        return data.message;
      })
      .catch((error) => {
        console.error('There was a problem with the fetch operation:', error);
        return null;
      });
      return response
  }

  async getdstring():Promise<string | null>{
    let response = await  fetch('https://localhost:5000/dString', {
      method: 'POST',
      headers: this.headers,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        return data.message;
      })
      .catch((error) => {
        console.error('There was a problem with the fetch operation:', error);
        return null;
      });
      return response
  }

  hash_func(data:string):string{
    const secretstring = this.getsecretstring();
    const dstring=this.getdstring()
    const initial_string = dstring+ String(data)
    const hash1 = CryptoJS.SHA512(initial_string).toString(CryptoJS.enc.Hex);
    const combined_string = hash1 + initial_string
    const final_string = combined_string + secretstring;
    const final_hash = CryptoJS.SHA512(final_string).toString(CryptoJS.enc.Hex);
    return ""+String(final_hash)
  };

  private refreshTimeout: any; 

  scheduleTokenRefresh() {
    const token = this.userService.getToken();
    if (token) {
      const decodedToken = jwtDecode<any>(token);
      const expiryTime = decodedToken.exp;
      const currentTime = Math.floor(Date.now() / 1000);
      const bufferTime = 5 * 60; 

      if (expiryTime - currentTime > bufferTime) {
        const refreshTime = (expiryTime - currentTime - bufferTime) * 1000;

        if (this.refreshTimeout) {
          clearTimeout(this.refreshTimeout);
        }

        this.refreshTimeout = setTimeout(() => this.expired_newtoken(), refreshTime);
      } else {
        console.warn('Token is too close to expiry. Refreshing now.');
        this.expired_newtoken();
      }
    }
  }

  
  validateAndSetToken(token:string|null): boolean|null {
    if (token){
    const decodedToken = jwtDecode<any>(token);
    const expiryTime = decodedToken.exp; 
    const currentTime = Math.floor(Date.now() / 1000); 
    
    if (expiryTime > currentTime) {
      this.userService.setToken(token);
      this.scheduleTokenRefresh();
      return true;
    } else {
      console.warn('Token is expired.');
      return false;
    }}
    else{
      return null;
    }
  }
  
  expired_newtoken() {
    const accounts = this.msalService.instance.getAllAccounts();
    
    if (accounts.length === 0) {
      console.error('No signed-in accounts found.');
      this.router.navigate(['/']);
      return;
    }
  
    this.msalService.instance.acquireTokenSilent({ 
      scopes: ['User.Read'],
      account: accounts[0],
      forceRefresh: true 
    })
    .then(response => {
      const newAccessToken = response.idToken;
      this.headers['Authorization'] = `Bearer ${newAccessToken}`;
      this.headers['Content-Type'] = `application/json`;
      this.userService.setToken(newAccessToken);
  
      if (this.validateAndSetToken(newAccessToken)) {
        console.log('Token refreshed successfully.');
        this.token=newAccessToken;
      } else {
        console.error('Failed to validate the new token. Redirecting to login.');
        this.router.navigate(['/']);
      }
    })
    .catch(error => {
      console.error('Silent token acquisition error:', error);
      this.router.navigate(['/']);
    });
  }
  
  
  

  

  showConnectGoogleDialog(): void {
    const dialogRef = this.dialog.open(CldrDialogComponent, {
      width: '400px',
      disableClose: true,  
      autoFocus : true,
      panelClass: 'custom-dialog',
      backdropClass: 'custom-backdrop',
      data: { }
    });
    
  
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log("Dialog closed, Google Sign-In triggered.");
      }
    });
  }
  
  preloadTabs() {
    setTimeout(() => {
      this.tabsLoaded = true; 
    }, 0);
  }

  async checkDeviceAndScan() {
    const info = await Device.getInfo();
    console.log('Device Info:', info);
  
    if (info.platform !== 'web') {  
      let networks = await this.scanWiFiNetworks();  
      return networks;
    } else {
      console.log('WiFi scanning is not available in a browser environment.');
      return [];
    }
  }
  

  async scanWiFiNetworks() {
    const nworks: Array<{ SSID: string; BSSID: string; RSSI: number; Frequency: number }> = [];
  
    return new Promise((resolve, reject) => {
      wifi.scan(
        function (networks: any) {
          networks.forEach((network: any) => {
            const networkData = {
              SSID: network.SSID,
              BSSID: network.BSSID,
              RSSI: network.RSSI,
              Frequency: network.Frequency,
            };
  
            nworks.push(networkData);
  
            console.log('SSID:', network.SSID);
            console.log('BSSID (MAC Address):', network.BSSID);
            console.log('Signal Strength (RSSI):', network.RSSI);
            console.log('Frequency:', network.Frequency);
          });
  
          console.log('All Networks:', nworks);
          resolve(nworks);
        },
        function (error: any) {
          console.error('WiFi Scan Error:', error);
          reject(error); 
        }
      );
    });
  }
  
  
  
  
  openTab(tab: string) {
    this.activeTab = tab;
  }
  async ngOnInit() {
    this.token = this.userService.getToken();
    
    this.preloadTabs();
    this.showConnectGoogleDialog(); 
    if (!this.token) {
      console.error('No token found. Redirecting to login.');
      this.router.navigate(['/']); 
      return;
    }

    const httpHeaders = new HttpHeaders()
      .set('Authorization', `Bearer ${this.token}`)
      .set('Content-Type', 'application/json');

    this.headers = {};
    httpHeaders.keys().forEach(key => {
      const values = httpHeaders.getAll(key);
      
      if (values) {
        this.headers[key] = values.join(', ');
      }
    }); 
    
    Geolocation.watchPosition(
      {
        enableHighAccuracy: true,  
        timeout: 20000,
        maximumAge: 0
      },
      async(coords: any) => {
        
        let networks = await this.checkDeviceAndScan();  
        
        this.currentCoords = coords;
        if (this.currentCoords && this.currentCoords.coords) {
          this.location = {
            lat: this.currentCoords.coords.latitude,
            lng: this.currentCoords.coords.longitude,
            accuracy: this.currentCoords.coords.accuracy,
            speed: this.currentCoords.coords.speed !== null ? this.currentCoords.coords.speed : undefined 
          };

          const timestamp = this.currentCoords.timestamp;
          if (!this.previous_location || 
              this.previous_location[0] !== this.location.lat || 
              this.previous_location[1] !== this.location.lng) {
            this.previous_location = [this.location.lat, this.location.lng];

            const status = await Network.getStatus();
            const deviceId =getDeviceId();
            const isLikelyWiFi = async () => {
              const startTime = performance.now();
              try {
                await fetch("https://localhost:5000/ping");
                const latency = performance.now() - startTime;
                return latency < 100; 
              } catch (error) {
                return false; 
              }
            };
            (async () => {
              let connectionType = "";
            
              await isLikelyWiFi().then((isWiFi) => {
                console.log(isWiFi ? "Connected via Wi-Fi" : "Not connected via Wi-Fi");
                connectionType = isWiFi ? "wifi" : "not wifi";
              });
            
              if (this.token == null) {
                console.error("No token");
                return; 
              }
            
              if (!this.validateAndSetToken(this.token)) {
                await this.expired_newtoken();
              }
            
            
            if (this.token==null){
              console.error('no token');
            }
            if (!this.validateAndSetToken(this.token)) {
              this.expired_newtoken();
            }
            
            const anonymized_deviceId= this.hash_func(await deviceId);
            let response = await fetch('https://localhost:5000/sendlocation', {
              method: 'POST', 
              headers: {
                ...this.headers, 
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                lat: this.location.lat,
                lng: this.location.lng,
                accuracy: this.location.accuracy,
                timestamp: timestamp,
                deviceId: anonymized_deviceId,
                connectionType: connectionType,
                speed: this.location.speed || '',
                networks: JSON.stringify(networks) || '',
              }),
            });            
            
            if (response.ok) {
                const responseData = await response.json();
                console.log('Location data sent successfully:', responseData);
              } else {
                console.error('Failed to send location. Status:', response.status);
              }
            
          })();
        }
      }
  });

  } 
  

  
}
