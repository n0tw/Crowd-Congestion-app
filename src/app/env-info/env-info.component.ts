import { Component, OnInit, HostListener, ViewChild} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { MatDatepicker } from '@angular/material/datepicker';
import { Router } from '@angular/router';
import { UserService } from '../authent/user.service';
import { HttpHeaders } from '@angular/common/http';
import 'chartjs-adapter-moment';
import moment from 'moment';
import 'moment-timezone';

interface DataPoint {
  recvTime: Date;  
  value: number;
  attrValue: string;
  attrName?: string; 
}

@Component({
  selector: 'app-env-info',
  templateUrl: './env-info.component.html',
  styleUrls: ['./env-info.component.css']
})
export class EnvInfoComponent implements OnInit {
  @ViewChild('startPicker') startPicker!: MatDatepicker<any>;
  @ViewChild('endPicker') endPicker!: MatDatepicker<any>;
  isSmallScreen: boolean;
  endDate: Date | null = new Date();
  startDate: Date | null = moment(this.endDate).subtract(24, "hours").toDate();
  data: any[] = [];
  token: string | null = null;
  Headers: Record<string, string> = {};
  arrowImage!: HTMLImageElement;
  
  tables = [
    { name: "Wind Direction", tn: "environmental_Weather_Wind_WeatherObserved", chartId: "chart_WeatherObserved_Wind_1", attrs: ['windDirection']},
    { name: "Wind Speed", tn: "environmental_Weather_Wind_WeatherObserved", chartId: "chart_WeatherObserved_Wind_2", attrs: ['windSpeed']},
    { name: "Atmospheric", tn: "environmental_Weather_Atmospheric_WeatherObserved", chartId: "chart_WeatherObserved_Atmospheric_1",attrs:['rainMinTime', 'precipitation', 'directIrradiation']},
    { name: "Atmospheric", tn: "environmental_Weather_Atmospheric_WeatherObserved", chartId: "chart_WeatherObserved_Atmospheric_5",attrs: [ 'airTemperatureTSA', 'relativeHumidity']},
    { name: "Pressure", tn: "environmental_Weather_Atmospheric_WeatherObserved", chartId: "chart_WeatherObserved_Atmospheric_3",attrs: ['atmosphericPressure']},
    { name: "Noise Level", tn: "environmental_NoiseLevel_NoiseLevelObserved", chartId: "chart_NoiseLevelObserved_1",attrs: ['LAS', 'LAeq', 'LAmax', 'LCeq', 'LCmin', 'LCmax', 'LAmin', 'LCf', 'LCs', 'LAf']},
    { name: "Temperature Predictions", tn: "", chartId: "chart_Meteo_futureTemperature", attrs: ["temperature_2m"] }, 
    { name: "Past Temperatures", tn: "", chartId: "chart_Meteo_pastTemperature", attrs: ["temperature_2m"] } 
  ];

  private baseUrl: string = 'https://localhost:5000/api/';
  private chartInstances: { [key: string]: Chart } = {};

  constructor(private http: HttpClient, private userService: UserService, private router: Router ) {this.isSmallScreen = window.innerWidth <= 590;}

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.isSmallScreen = event.target.innerWidth <= 590;
  }


  ngOnInit(): void {
    this.token = this.userService.getToken();
    if (!this.token) {
      console.error('No token found. Redirecting to login.');
      this.router.navigate(['/login']);
      return;
    }
    this.arrowImage = new Image();
    this.arrowImage.src = '../../media/arrow.png';
    this.arrowImage.onload = () => {
      console.log('Arrow image successfully loaded');
    };
    this.arrowImage.onerror = () => {
      console.error('Failed to load the arrow image');
    };
    Chart.register(...registerables);
    this.fetchData();
  }

  refresh(){
    this.endDate = new Date();
    this.startDate = moment(this.endDate).subtract(24, "hours").toDate();
    this.fetchData();
  }

  fetchData() {
    this.token = this.userService.getToken();
    if (!this.token) {
      console.error('No token found. Redirecting to login.');
      this.router.navigate(['/login']); 
      return;
    }

    const Headers = new HttpHeaders()
        .set('Authorization', `Bearer ${this.token}`)
        .set('Content-Type', 'application/json');
    
        
    this.tables.forEach(table => {
      if (table.tn) {
        const endDateStr = (this.endDate ?? new Date()).toISOString();
        const startDateStr = (this.startDate ??moment(new Date()).subtract(24, "hours").toDate()).toISOString();
        this.http.get<any[]>(`${this.baseUrl}${table.tn}/${table.attrs}/${startDateStr}/${endDateStr}`, 
          { headers: Headers }).subscribe({
          
          next: (res: any) => {
            if (res && res.length > 0) {
              
              let data: any = {};
              
              table["attrs"].forEach((attr: string) => {
                  data[attr] = res.filter((d: DataPoint) => d.attrName === attr);
              });
              
              this.data.push(res);  
              let dt: any[] = [];
              Object.keys(data).forEach(attrKey => {
                const nsDt = data[attrKey];
                if (nsDt && nsDt.length > 0) {
                  dt.push(this.processAndDisplayData(nsDt));
                }
                
              });
              this.updateChart(table.chartId, dt, table["attrs"]);
              
            } else {
              let dt: any[] = [];
              this.updateChart(table.chartId, dt, table["attrs"]);
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
    else{
      const params = { latitude: 38.28774925799491, longitude: 21.786997999387864, hourly: "temperature_2m" };
      let url;
      if (table.chartId==="chart_Meteo_futureTemperature"){
        url = `https://api.open-meteo.com/v1/forecast?latitude=${params.latitude}&longitude=${params.longitude}&hourly=${params.hourly}`;
      }
      else{
        let startD = moment(this.startDate).tz('Europe/Athens').format('YYYY-MM-DD');
        let endD = moment(this.endDate).tz('Europe/Athens').subtract(1, 'days').format('YYYY-MM-DD')
        const en =new Date();
        const st = moment(en).subtract(24, "hours").toDate();
        if (endD===moment(en).tz('Europe/Athens').subtract(1, 'days').format('YYYY-MM-DD') && startD===moment(st).tz('Europe/Athens').format('YYYY-MM-DD')){
          endD = moment(this.endDate).tz('Europe/Athens').subtract(2, 'days').startOf('day').format('YYYY-MM-DD')
          startD = moment(this.startDate).tz('Europe/Athens').subtract(1, 'days').startOf('day').format('YYYY-MM-DD')
        }
        url = `https://archive-api.open-meteo.com/v1/archive?latitude=${params.latitude}&longitude=${params.longitude}&start_date=${startD}&end_date=${endD}&hourly=${params.hourly}`;
      }
      fetch(url)
        .then(response => response.json())
        .then(data => {
          

          const hourlyTime = data.hourly.time.map((t: string) => moment.tz(t, 'Europe/Athens'));
          const hourlyTemperature = data.hourly.temperature_2m;

          let weatherData = hourlyTime
            .map((time:any, index:number) => ({
              x: time.toDate(),
              y: hourlyTemperature[index],
            }))
          
            if (table.chartId === "chart_Meteo_futureTemperature") {
              const greeceTime = moment().tz('Europe/Athens');
              const cutoffTime = greeceTime.clone().add(24, 'hours');
              weatherData = weatherData.filter((dataPoint: any) => moment(dataPoint.x).isBetween(greeceTime, cutoffTime, undefined, '[)'));
              console.log("table.name",table.name);
            }else{
              const hasNullValues = weatherData.some((dataPoint: any) => dataPoint.y === null);
  
              if (hasNullValues) {
                console.warn("Warning: weatherData contains null values!", weatherData);
              }
            }
            if (weatherData.length > 24) {
              const interval = Math.floor(weatherData.length / 24); 
              weatherData = weatherData.filter((index:number) => index % interval === 0);
            
              if (weatherData.length > 24) {
                weatherData = weatherData.slice(0, 24);
              }
            }
            

          this.updatemeteoChart(table.chartId, [weatherData], ['Temperature (°C)']);
        })
        .catch(error => {
          console.error('Error fetching Meteo data:', error);
        });
        }
          
        });
    
  }
    
  updatemeteoChart(chartId: string, data: any[][], attrs: string[]) {
    const ctx = document.getElementById(chartId) as HTMLCanvasElement;
    if (!ctx) {
      console.error(`Canvas with ID ${chartId} not found`);
      return;
    }
  
    if (this.chartInstances[chartId]) {
      this.chartInstances[chartId].destroy();
    }
  
    if (!data || data.length === 0 || !data[0] || data[0].length === 0) {
      console.warn(`No data available to plot on chart ${chartId}`);
      return;
    }
  
    const labels = data[0].map((d: any) => d.x || 'Invalid Date');
  
    const datasets = attrs.map((attr, index) => ({
      label: attr,
      data: data[index]?.map((d: any) => ({
        x: d.x,
        y: d.y,
      })) || [],
      borderColor: `rgba(${75 + index * 70}, ${192 - index * 70}, 240, 1)`,
      backgroundColor: `rgba(${75 + index * 70}, ${192 - index * 70}, 240, 0.8)`,
      borderWidth: 1,
      pointRadius: 4,
    }));
  
    const newChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              parser: 'yyyy-MM-dd HH:mm',
              displayFormats: {
                minute: 'ddd, HH:mm',
                hour: 'ddd, HH:mm'
              },
            },
            title: {
              display: true,
            },
            ticks: {
              autoSkip: true,       
              maxTicksLimit: 5,     
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
            },
          },
        },
      },
      
    });
  
    this.chartInstances[chartId] = newChart;
  }
  

  processAndDisplayData( nsDt: DataPoint[]) {
    const processedData = nsDt.map((d: DataPoint) => {
      let parsedValue: string = '';
      try {
          parsedValue = d.attrValue;
      } catch (error) {
        console.error(`Error parsing JSON: ${(error as Error).message}`);
        parsedValue = d.attrValue;
      }
  
      const value = Number(parsedValue);
      const recvTimeUTC = moment.utc(d.recvTime, "YYYY-MM-DD HH:mm:ss.SSS");
      const dateObserved = recvTimeUTC.tz('Europe/Athens');

      if (!dateObserved) {
        console.warn(`Invalid date parsing for: ${d.recvTime}`);
      }
      const attrName = typeof d.attrName === 'string' ? d.attrName : 'unknownAttribute'; 
      
      return {
        dateObserved: dateObserved.format("ddd, HH:mm"),
        displayLabel: dateObserved.format("YYYY-MM-DD HH:mm"),
        [attrName]: value  
      }; 
    });

    return processedData;
    
  }  
  
  
  updateChart(chartId: string, data: any[][], attrs: string[]) {
    const ctx = document.getElementById(chartId) as HTMLCanvasElement;
    if (!ctx) {
      console.error(`Canvas with ID ${chartId} not found`);
      return;
    }
  
    if (this.chartInstances[chartId]) {
      this.chartInstances[chartId].destroy();
    }
  
    if (!data || data.length === 0 || !data[0] || data[0].length === 0) {
      console.warn(`No data available to plot on chart ${chartId}`);
      return;
    }
  
    let minY = Infinity;
    let maxY = -Infinity;
  
    const labels = data[0].map((d: any) => d.dateObserved || 'Invalid Date');
  
    const datasets = attrs.map((attr, index) => {
      const attrData = data[index]?.map((d: any) => {
        const value = +d[attr] || 0;
        if (value < minY) minY = value;
        if (value > maxY) maxY = value;
        return {
          x: d.dateObserved, 
          y: value, 
          direction: -value|| 0, 
        };
      }) || [];
  
      const isWindDirection = attr === 'windDirection';
  
      return {
        label: attr,
        data: attrData,
        backgroundColor: isWindDirection ? 'transparent' : `rgba(${75 + index * 50}, ${192 - index * 30}, ${192 - Math.pow(-1, index) * index * 30}, 0.5)`,
        borderColor: isWindDirection ? 'transparent' : `rgba(${75 + index * 50}, ${192 - index * 30}, ${192 - Math.pow(-1, index) * index * 30}, 1)`,
        borderWidth: isWindDirection ? 0 : 1,
        pointRadius: isWindDirection ? 0 : 3, 
        showLine: !isWindDirection, 
      };
    });
  
    const newChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        scales: {
          x: {
            time: {
              parser: 'yyyy-MM-dd HH:mm',
            },
            ticks: {
              callback: function (value, index, ticks) {
                const totalLabels = ticks.length;
                const maxLabels = 5;
                const step = Math.ceil(totalLabels / maxLabels);
  
                if (index % step === 0) {
                  return labels[index];
                }
                return null;
              },
            },
          },
          y: {
            min: minY,
            max: maxY,
            beginAtZero: true,
          },
        },
      },
        
      plugins: [
        {
          id: 'windDirectionIcons',
          afterDatasetsDraw: (chart) => {
            const datasetIndex = attrs.indexOf('windDirection');
            if (datasetIndex === -1) return; 
            
            if (!this.arrowImage.complete) {
              console.warn('Arrow image not loaded');
              return;
            }
      
            const dataset = chart.data.datasets[datasetIndex];
            const meta = chart.getDatasetMeta(datasetIndex);
      
            dataset.data.forEach((point: any, index: number) => {
              
              if (!point.direction) return; 
              const { x, y } = meta.data[index]; 
              const directionRadians = (point.direction * Math.PI) / 180; 
              const iconSize = 11; 
              const ctx = chart.ctx;
      
              ctx.save();
              ctx.translate(x, y); 
              ctx.rotate(directionRadians); 
              ctx.drawImage(this.arrowImage, -iconSize / 2, -iconSize / 2, iconSize, iconSize); 
              ctx.restore();
            });
          },
        },
      ],
      
    });
  
    this.chartInstances[chartId] = newChart;
  }
  
}
