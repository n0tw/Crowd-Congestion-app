import { Component, Input, OnInit, OnDestroy,  Output, EventEmitter } from '@angular/core';
import { LineController, LineElement, PointElement, LinearScale, TimeScale } from 'chart.js';
import { CommonModule } from '@angular/common';
import { Chart } from 'chart.js/auto';
import { UserService } from '../authent/user.service';
import { HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-info-window-content',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './info-window-content.component.html',
  styleUrl: './info-window-content.component.css'
})
export class InfoWindowContentComponent implements OnInit, OnDestroy {
  token: string | null = null;
  headers: Record<string, string> = {};
  @Input() position: { lat: number, lng: number } = { lat: 0, lng: 0 };
  @Input() title!: string;
  @Input() buslines?: string[][];
  @Input() customStyle: string = '';
  @Output() contentReady = new EventEmitter<boolean>();
  private chartInstances: { [key: string]: any } = {};
  chart: any; 
  constructor(
    private userService: UserService,
    private router: Router,
    private http: HttpClient
  ) {}

  process_data(data?: { datetime: string, value: number }[]): [{ x: Date; y: number }[], { x: Date; y: number }[]] {
    if (data) {
      const dataArray = [];
      for (let i = 0; i < data.length; i++) {
        dataArray.push({ x: new Date(data[i].datetime), y: data[i].value });
      }
      return [dataArray, []];
    } else {
      const now = new Date();
      const HoursBefore = new Date(now.getTime() - 1 * 60 * 60 * 1000);
      const HoursAfter = new Date();
      const dataArray1 = [];

      for (let time = new Date(HoursBefore); time <= HoursAfter; time.setMinutes(time.getMinutes() + 1)) {
        dataArray1.push({ x: new Date(time), y: 0 });
      }
      return [dataArray1, []];
    }
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
    }
  }
  plotTimeSeriesData(
    chart_name: string,
    animation_duration: number,
    y_title: string,
    recorded: { x: Date; y: number }[],
    projected: { x: Date; y: number }[]
  ): void {
    let parameter_max_height_percentage = 1.25;
    let dataArray1 = recorded;
    let dataArray2 = projected;

    let current_measurement = dataArray1[dataArray1.length - 1];
    dataArray2 = [current_measurement, ...dataArray2]; 

    let all_data = dataArray1.concat(dataArray2);
    const yValues = all_data.map(item => item.y);
    const max = Math.max(...yValues);
    let y_lim = parameter_max_height_percentage * max;
    if (this.chart) {
      console.log("Chart already created. Skipping.");
      return;  
    }
    

    if (this.chartInstances[chart_name]) {
      this.chartInstances[chart_name].destroy();
      this.chartInstances[chart_name] = null;
      delete this.chartInstances[chart_name];
    }
  
    const canvasParent = document.getElementById(chart_name)?.parentElement;
    if (canvasParent) {
      document.getElementById(chart_name)?.remove();
      const newCanvas = document.createElement("canvas");
      newCanvas.id = chart_name;
      canvasParent.appendChild(newCanvas);
    }
  
    const canvas = document.getElementById(chart_name) as HTMLCanvasElement;
    if (!canvas) {
      console.error(`Canvas with ID ${chart_name} not found!`);
      return;
    }
  
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error(`Failed to get 2D context for ${chart_name}`);
      return;
    }
  
    try {
      this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: "Invisible",
            data: [{ x: current_measurement.x, y: y_lim }],
            pointRadius: 0,
          },
          {
            label: "Current",
            data: [current_measurement],
            borderColor: 'rgb(14, 160, 238)',
            backgroundColor: 'rgb(14, 160, 238)',
            pointRadius: 5,
            pointHoverRadius: 10
          },
          {
            label: 'Recorded',
            data: dataArray1,
            borderColor: 'rgba(14, 160, 238, 0.692)',
            fill: true,
            backgroundColor: "rgba(14, 160, 238, 0.692)",
            pointRadius: 0,
          },
          {
            label: 'Projected',
            data: dataArray2,
            borderColor: 'rgba(128, 128,128, 0.2)',
            fill: true,
            backgroundColor: "rgba(128, 128, 128,0.05)",
            pointRadius: 0,
          }
        ]
      },
      options: {
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              parser: 'HH:mm',
              tooltipFormat: 'h:mm a',
              unit: 'minute',
              displayFormats: {
                minute: 'h:mm a',
                hour: 'h:mm a'
              }
            },
            ticks: {
              autoSkip: true,
              callback: function (tickValue) {
                const date = new Date(Number(tickValue));
                return date.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
              }
            },
            afterBuildTicks: (scale) => {
              scale.ticks = scale.ticks.filter(tick => {
                const date = new Date(tick.value);
                const minutes = date.getMinutes();
                return minutes % 20 === 0;
              });
            },
            min: Number(dataArray1[0].x),
            max: Number(dataArray2[dataArray2.length - 1].x)
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: y_title
            }
          }
        },
        animation: {
          duration: animation_duration, 
        },
      }
    });
    console.log("Chart created successfully!");
  } catch (err) {
    console.error("Chart.js error:", err);
  }
}

  
getChartInstance() {
  return this.chart;
}

  ngOnInit(): void {
    Chart.register(TimeScale);
    Chart.register(LineController, LineElement, PointElement, LinearScale);

    this.token = this.userService.getToken();
    if (!this.token) {
      console.error('No token found. Redirecting to login.');
      this.router.navigate(['/']); 
      return;
    }

    const httpHeaders = new HttpHeaders()
      .set('Authorization', `Bearer ${this.token}`)
      .set('Content-Type', 'application/json');

    const duration = 60 * 60 * 1000;
    this.headers = {};
    httpHeaders.keys().forEach(key => {
      const values = httpHeaders.getAll(key);
      if (values) {
        this.headers[key] = values.join(', ');
      }
    });

    this.http.get(`https://localhost:5000/waiting_at_location?lat=${this.position.lat}&lng=${this.position.lng}&duration=${duration}`, { headers: this.headers })
      .subscribe(
        (data: any) => {
          let lineSizeData;
          if (data.length > 0) {
            lineSizeData = this.process_data(data);
          } else {
            lineSizeData = this.process_data();
          }
          this.plotTimeSeriesData('lineSizeChart', 1400, 'People', lineSizeData[0], []);
          const lastLineSize = lineSizeData[0][lineSizeData[0].length - 1].y;
          document.getElementById('current_LineSize')!.textContent = lastLineSize.toString();
          this.contentReady.emit(true);
          this.contentReady.emit(true);
        },
        error => {
          console.error('Error sending location:', error);
        }
      );
  }
}
