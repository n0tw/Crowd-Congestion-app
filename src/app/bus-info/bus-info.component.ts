import { Component, Renderer2, Input, QueryList, ViewChildren, ElementRef, ViewChild, ComponentRef, ViewContainerRef, AfterViewInit, OnDestroy,  OnInit, ChangeDetectorRef,OnChanges, SimpleChanges } from '@angular/core';
import { GoogleMapsModule, MapMarker, GoogleMap } from '@angular/google-maps';
import { DataService } from './data.service';
import { DataModel } from './data.model';
import { CommonModule } from '@angular/common';
import { Subscription, BehaviorSubject, combineLatest } from 'rxjs';
import { InfoWindowContentComponent } from '../info-window-content/info-window-content.component';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { ExceldataComponent } from '../exceldata/exceldata.component';
import { UserService } from '../authent/user.service';
import { HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';

interface  markerIcon {
  url: string
}

interface Marker {
  position: google.maps.LatLngLiteral;
  icon: markerIcon;
  label: string;
  value: string;
  lines: string[]
  buslines?: string[][];
}

export interface Vehicle {
  line: string;
  departure: string;
  route: string;
}

@Component({
  selector: 'app-bus-info',
  templateUrl: './bus-info.component.html',
  styleUrls: ['./bus-info.component.css'],
  standalone: true,
  imports: [CommonModule, 
    GoogleMapsModule,
    InfoWindowContentComponent, FormsModule, HttpClientModule],
})
export class BusInfoComponent implements OnInit, AfterViewInit, OnDestroy {
  station: string = '';
  vehicles: Vehicle[] = [];
  tableHeaders: string[] = [];
  vhs: string[] = [];
  busData: any;
  selectedColumnIndex: number=-1;
  private dataSubscription!: Subscription;
  private viewInit$ = new BehaviorSubject<boolean>(false);
  private data$ = new BehaviorSubject<DataModel | null>(null);
  map!: google.maps.Map;
  searchText: string = '';
  isDropdownVisible: boolean = false;
  excelData: any[] = [];
  private excelRawData: any[][] | null = null;
  private globalClickListener: (() => void) | null = null;
  infoWindows: google.maps.InfoWindow[] = [];
  isDialogOpen = false; 
  headers: any;
  public display!: { lat: number, lng: number };
  token: string | null = null;
  Headers: Record<string, string> = {};
  heatmapLayer: google.maps.visualization.HeatmapLayer | null = null;
  private readonly apiUrl = 'https://localhost:5000/api/all-data';
  constructor(
    private http: HttpClient,
    private renderer: Renderer2,
    private el: ElementRef,
    private dataService: DataService,
    private viewContainerRef: ViewContainerRef,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private userService: UserService, 
    private router: Router
  ) {
    this.initializeInfoWindows();
  }
  
  @Input() location!: { lat: number, lng: number };
  @ViewChild('searchInput', { static: true }) searchInputElement!: ElementRef;
  @ViewChild(GoogleMap) googleMapInstance!: GoogleMap;
  
  heatmapVisible = false;
  heatmapData: google.maps.visualization.WeightedLocation[] = [];
  filteredExcelData: any[] = [];

  options = [
    { label: '601 Πανεπιστήμιο - Νοσοκομείο', value: '601' },
    {label: '604 Πανεπιστήμιο - Νοσοκομείο - Ρίο', value: '604' },
    {label: '605 Πανεπιστήμιο - Νοσοκομείο - Άγ. Βασίλειος - Ρίο', value: '605' },
    {label: '609 Κέντρο', value: '609' },
    {label: '602 Express Πανεπιστήμιο - Νοσοκομείο', value: '602' },
    {label: '610 Express Κέντρο', value: '610' },
    {label: '901 Πανεπιστήμιο - Νοσοκομείο μέσω Έλληνος Στρατιώτου', value: '901' },
    {label: '902 Κέντρο μέσω Έλληνος Στρατιώτου', value: '902' }
  ];
  isLocationChecked = false; 
  filtOptns = [...this.options];
  async getUserLocation(event: MouseEvent): Promise<void> {
    const checkbox = event.target as HTMLInputElement; 
  
    if (checkbox.checked) {
      this.isLocationChecked =true;
      try {
        const response = await fetch('https://localhost:5000/walk_toStation', {
          method: 'POST',
          headers: {
            ...this.Headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ location }),
        });
        if (!response.ok) {
          throw new Error('Failed to fetch duration');
        }
        const data = await response.json();
        
        if (this.markers[data.index]) {
          const marker = this.markers[data.index];
          const infoWindow = this.infoWindows[data.index];
          const mapMarker = this.mapMarkers.toArray()[data.index];
  
          this.markerClicked(marker, infoWindow, mapMarker);
          this.filtOptns = marker.lines.length > 0
                    ? this.options.filter(opt => marker.lines.includes(opt.value))
                    : [this.options[0]]; 
          
        }

      } catch (error) {
        console.error('Error fetching walk duration:', error);
      }
    } else {
      this.isLocationChecked =false;
      this.filtOptns = [...this.options];
    }
    this.filteredOptions=this.filtOptns;
  }
  toggleHeatmap() {
    if (!this.heatmapLayer) {
      this.heatmapLayer = new google.maps.visualization.HeatmapLayer({
        data: this.heatmapData,
        gradient: ['rgba(0, 255, 255, 0)', 'rgba(0, 255, 255, 1)', 'rgba(0, 127, 255, 1)', 'rgba(0, 0, 255, 1)'],
        radius: 20,
        opacity: 0.7
      });
    }
    this.updateHeatmapData();

    this.heatmapVisible = !this.heatmapVisible;

    this.heatmapLayer.setMap(
      this.heatmapVisible ? this.googleMapInstance.googleMap ?? null : null
    );
  }
  
  updateHeatmapData() {
    this.http.get<any[]>(this.apiUrl, { headers: this.Headers }).subscribe({
      
      next: (res: any) => {
        if (res && res.length > 0) {
            for(let i=0;i<res.length; i++){
              this.heatmapData.push({
                location: new google.maps.LatLng(res[i].location[0], res[i].location[1]),
                weight: res[i].crowd_size
              })
            }
            if (this.heatmapVisible && this.heatmapLayer) {
              this.heatmapLayer.setData(this.heatmapData);
            }
          } 
          
        else {
          console.warn(`No data received for`);
        }
      },
      error: (error) => {
        console.error('Error fetching data:', error);
      },
      complete: () => {
        console.log('Data fetch complete');
      }
    });
    
  }
  

  ngOnInit(): void {
    this.heatmapLayer= null;
    this.token = this.userService.getToken();
    if (!this.token) {
      console.error('No token found. Redirecting to login.');
      this.router.navigate(['/']); 
      return;
    }
    const httpHeaders = new HttpHeaders()
        .set('Authorization', `Bearer ${this.token}`)
        .set('Content-Type', 'application/json');
    this.Headers = {};
    httpHeaders.keys().forEach(key => {
      const values = httpHeaders.getAll(key);
      if (values) {
        this.Headers[key] = values.join(', ');
      }
    });


    this.loadheaders();
    this.updateHeatmapData();
    this.globalClickListener = this.renderer.listen('document', 'click', (event) => {
      if (!this.el.nativeElement.contains(event.target)) {
        this.isDropdownVisible = false;
      }
    });

    this.dataSubscription = this.dataService.getDataPolling().subscribe(data => {
      console.log("dddata, ,,", data);
      if (data.length>0){
        for(let d of data){
          this.busData = d;
          this.extractStationData(d); 
          this.updateTable(d.station); 
          this.cdr.detectChanges(); 
        }
      }
      
    });

    combineLatest([this.viewInit$, this.data$]).subscribe(([viewInit, data]) => {
      if (viewInit && data) {
        setTimeout(() => this.updateTable(data.station), 0);  
      } else {
        console.log('View or data not ready yet', { viewInit, data });
      }
    });
    
  }

  filteredOptions = this.options;
  toggleDropdown(visible: boolean) {
    if (visible) {
      this.isDropdownVisible = true;
    } else {
      setTimeout(() => { 
        this.isDropdownVisible = false;
      }, 200);
    }
  }
  

  filterDropdown() {
    if (this.searchText) {
      this.filteredOptions = this.filtOptns.filter(option =>
        option.label.toLowerCase().includes(this.searchText.toLowerCase())
      );
    } else {
      this.selectedColumnIndex =-1;
      this.filteredOptions = [...this.filtOptns]; 
    }
  }
  
  onOptionSelected(option: any) {
    this.searchText = option.label; 
    this.isDropdownVisible = false; 
    const firstRow = this.headers;  
    
    this.selectedColumnIndex = firstRow.indexOf(option.value);
  }

  chunkArray(array: any[]): any[][] {
    const result: any[][] = [[], [], []]; 
    let j=0
    for (let i = 0; i < array.length; i++) {
      
      if (array[i]=="Σάββατο") {
        j=1
      } else if (array[i]=="Κυριακή και Αργίες") {
        j=2
      } else if (array[i]!="Καθημερινά"){
        if(array[i]!="")
        result[j].push([array[i]]);
      }
    }
    return result;
  }
  
  filterDataBySelection(selectedColumnIndex: number) {
    if (selectedColumnIndex !== -1) {
        const chunkedData = this.chunkArray(this.filteredExcelData);
        
        this.filteredExcelData = [];
        const maxLength = Math.max(...chunkedData.map(column => column.length));
        
        for (let i = 0; i < maxLength; i++) {
            const row = [];
            for (let j = 0; j < chunkedData.length; j++) {
                if (chunkedData[j][i] !== undefined) {
                    row.push(chunkedData[j][i]);
                } else {
                    row.push(''); 
                }
            }
            this.filteredExcelData.push(row);
        }

    } else {
        console.log('No matching column found for the selected value.');
        this.filteredExcelData = [];
    } 
    this.openFilteredDataDialog();
}

openFilteredDataDialog() {
  if (this.filteredExcelData.length === 0) {
    alert('No filtered data to display!');
    return;
  }

  this.dialog.open(ExceldataComponent, {
    width: '600px',
    disableClose: false,
    data: {
      title:this.searchText,
      filteredExcelData: this.filteredExcelData,
      headers: ["Καθημερινά", "Σάββατο", "Κυριακή και Αργίες"]
    }
  });
}

  
loadheaders(): Promise<void> {
  return new Promise((resolve, reject) => {

      this.http.get('assets/Program.xlsx', { responseType: 'arraybuffer' }).subscribe({
          next: (data: ArrayBuffer) => {
              try {
                  const workbook: XLSX.WorkBook = XLSX.read(data, { type: 'array' });
                  const sheetName: string = workbook.SheetNames[0];
                  const worksheet: XLSX.WorkSheet = workbook.Sheets[sheetName];
                  let excelRawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

                  if (excelRawData.length > 0) {
                      console.log('Excel data loaded successfully');
                      this.headers = excelRawData[0]|| [];
                      this.excelRawData =excelRawData;
                  } else {
                      console.log('Excel data is empty');
                      this.headers = []; 
                      this.excelRawData = null; 
                      resolve(); 
                  }
              } catch (error) {
                  console.error('Error parsing Excel data:', error);
                  reject(error); 
              }
          },
          error: (error: any) => {
              console.error('Error loading Excel file:', error);
              reject(error); 
          },
          complete: () => {
            console.log('Excel file loading complete');
            resolve(); 
          }
      });
  });
}

loadExcelFile(time?: string): Promise<void> {
  return new Promise((resolve, reject) => {
      var tm: number = -1;
      if (time) {
          tm = Number(time.substring(0, 2)) * 60 + Number(time.substring(3, 5));
      } 
      
      if (!this.excelRawData) {
        console.error("Excel data not loaded. Please load headers first.");
        reject("Excel data not loaded."); 
        return;
      }

      try {
        if (this.selectedColumnIndex !== -1 && this.selectedColumnIndex < this.headers.length ) {
          this.filteredExcelData = this.excelRawData.slice(1).map(row => row[this.selectedColumnIndex]);
          this.filteredExcelData = this.filteredExcelData.filter(cell => {
                        
          if (cell === undefined)
            return "";
          let c: string;
          
          if (typeof cell === 'number') {
              c = cell.toString();
          } else if (
              cell === "Καθημερινά" || cell === "Σάββατο" || cell === "Κυριακή και Αργίες"
          ) {
              return cell;
          } else {
              c = cell;
          }

          if (tm!==-1){
            if ( c.length === 5 && Math.abs(( Number(c.substring(0, 2)) * 60 + Number(c.substring(3, 5)) -tm)) < 60 ||
              (c.length === 4 && Math.abs((Number(c.substring(0, 1)) * 60 + Number(c.substring(2, 4)) -tm)) < 60)) {
              return c;}
          }else{
            return c;
          }
          
          return "";
        });
        resolve(); }
      } catch (error) {
          console.error('Error processing Excel data:', error);
          reject(error);
      }
  });
}

  
  markerIcon = {
    url: '\\media\\bus.png', 
    scaledSize: { width: 25, height: 25 }, 
  };

  handleEnterClick() {
    
    if (this.selectedColumnIndex === -1){
      alert("select a bus line");
    }
    else{
      const specifiedTime = (document.getElementById('timeinput') as HTMLInputElement).value;
      this.loadExcelFile(specifiedTime || undefined).then(() => {
        this.filterDataBySelection(this.selectedColumnIndex);
      }).catch(error => {
          console.error('Error during file load and filter:', error);
      });
      
    }
  }
  
  @ViewChild('dataTable', { static: false }) dataTableRef!: ElementRef<HTMLTableElement>;
  @ViewChildren(MapMarker) mapMarkers!: QueryList<MapMarker>;
  isTableOpen = false;
  center: google.maps.LatLngLiteral = { lat: 38.288983948547084, lng: 21.786131442096405 };
  zoom = 15.8;
  //display: any;

  markers: Marker[] = [
    { position: { lat: 38.2862010182659, lng: 21.786049311954574 }, icon: this.markerIcon, label: 'Chancellors Office', value: '678', lines:['601','602', '901']},
    { position: { lat: 38.28797289197418, lng: 21.78652843601951 },  icon: this.markerIcon,label: 'Polytechnio', value: '655', lines:['601','609','602','901','902','610']},
    { position: { lat: 38.28977270490379, lng: 21.78496964937884 }, icon: this.markerIcon,label: 'Conference Center', value: '654', lines:['601','609','602','901','902','610']},
    { position: { lat: 38.291728745799944, lng: 21.786964884964515 },icon: this.markerIcon, label: 'Physics Department', value: '679',  lines:['601','602', '901']},
    { position: { lat: 38.293692807759314, lng: 21.790486853464568 }, icon: this.markerIcon,label: 'Geology Department', value: '465' , lines:['601','602', '901']},
    { position: { lat: 38.2944747805789, lng: 21.791867835799813 }, icon: this.markerIcon,label: 'Medicine', value: '467', lines:['601','602', '901'] },
    { position: { lat: 38.296388013644, lng: 21.794956024153628 }, icon: this.markerIcon,label: 'Hospital', value: '534', lines:['609','610','902'] }
  ];
  
  initializeInfoWindows() {
    this.display = { lat: 0, lng: 0 };
    this.infoWindows = this.markers.map(() => new google.maps.InfoWindow());
  }


  

  ngAfterViewInit(): void {
    this.extractTableHeaders();
    this.viewInit$.next(true);
    const appRoot = document.querySelector('app-root');
    if (appRoot?.getAttribute('aria-hidden') === 'true') {
        appRoot.removeAttribute('aria-hidden');
    }
  }

  ngOnDestroy(): void {
    if (this.globalClickListener) {
      this.globalClickListener();
    }
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  extractTableHeaders() {
    if (this.dataTableRef) {
      const headers = this.dataTableRef.nativeElement.querySelectorAll('th');
      this.tableHeaders = Array.from(headers).map((header: HTMLElement) => header.innerText.trim());
    } else {
      console.warn('dataTableRef is not defined in extractTableHeaders');
    }
  }

  extractStationData(data: any) {
    if (data && data.station && data.vehicles) {
      this.station = data.station;
      this.vehicles = data.vehicles.map((vehicle: any) => ({
        line: vehicle.line || '',
        departure: vehicle.departure || '',
        route: vehicle.route || ''
      }));
      
    } else {
      console.warn('Station or vehicles data is not defined in extractStationData');
    }
  }
  
  clearColumn(columnIndex: number, vhs: string[]) {
    const tableBody = this.dataTableRef.nativeElement.querySelector('#table-body') as HTMLTableSectionElement;
    
    if (tableBody) {
      let rows = tableBody.rows.length;
      
      for (let i = 0; i < rows; i++) {
        const cell = tableBody.rows[i].cells[columnIndex];
        cell.classList.add('styled-cell');
        tableBody.rows[i].cells[columnIndex].style.cssText = "color: rgb(30, 31, 55);  font-weight: bold; font-family:' serif' ;";
        tableBody.rows[i].cells[columnIndex].innerText = "";
        if (i < vhs.length) {
          tableBody.rows[i].cells[columnIndex].innerText = vhs[i]; 
        } else {
          tableBody.rows[i].cells[columnIndex].innerText = ""; 
        }
      }
  
      for (let i = rows; i < vhs.length; i++) {
        const newRow = document.createElement('tr');
        this.tableHeaders.forEach((header, index) => {
          const newCell = document.createElement('td');
          if (index === columnIndex) {
            newCell.innerText = vhs[i]; 
          } else {
            newCell.innerText = ""; 
          }
          newRow.appendChild(newCell);
        });
        tableBody.appendChild(newRow);
      }
    }
  }
  
  
  updateTable(station: any) {
    
    if (!this.dataTableRef) {
      console.error('dataTableRef is not defined in updateTable');
      return;
    }
  
    const tableBody = this.dataTableRef.nativeElement.querySelector('#table-body');
    if (!tableBody) {
      console.error('Table body not found');
      return;
    }
    
    this.vhs= [];
    this.tableHeaders.forEach((header, columnIndex) => {
      if (header.substring(0, 3) ==station){
        const marker = this.markers.find(m => m.value.startsWith(header.substring(0, 3)));
        if(marker)
          marker.buslines = [];
        
        this.vehicles.forEach(vehicle => {
          const route = vehicle.route;

          const formattedString = `${vehicle.departure} \n ${vehicle.line} ${route}`;
          this.vhs.push(formattedString);

          if (marker && marker.buslines) {
            const buslineInfo =  [vehicle.line + " " + vehicle.route, vehicle.departure];
            marker.buslines.push(buslineInfo);
          }
        });
        this.clearColumn(columnIndex, this.vhs);
      }

    });
  
    this.cdr.detectChanges(); 
  }
  
  

  toggleMenu() {
    this.isTableOpen = !this.isTableOpen;
  }
  
  
  markerClicked(marker: Marker, infoWindow: google.maps.InfoWindow, mapMarker: MapMarker) {

    this.infoWindows.forEach((iw) => iw.close());

    const componentRef = this.viewContainerRef.createComponent(InfoWindowContentComponent);
    componentRef.instance.customStyle = "info-window";
    componentRef.instance.position = marker.position;
    componentRef.instance.title = marker.label;
    if (marker.buslines ) {
      componentRef.instance.buslines = marker.buslines.slice(0, 2) ;
    } else {
      componentRef.instance.buslines = [['No bus lines available']];
    }
    

    infoWindow.setContent(componentRef.location.nativeElement);
    infoWindow.open({
      anchor: mapMarker.marker,
      map: this.map,
      shouldFocus: false,
    });

    
    infoWindow.addListener('closeclick', () => {
      componentRef.destroy();
    });
  }
    
  
  moveMap(event: google.maps.MapMouseEvent) {
    if (event.latLng) {
      this.center = event.latLng.toJSON();
    }
  }

  move(event: google.maps.MapMouseEvent) {
    if (event.latLng) {
      this.display = event.latLng.toJSON();
    }
  }
}
