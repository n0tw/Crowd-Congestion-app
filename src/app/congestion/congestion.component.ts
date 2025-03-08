import { Component, OnInit } from '@angular/core';
import { SpotDataService } from './apestias.sevice';
import { Chart,registerables } from 'chart.js';
import { GoogleTokenService } from '../cldr-dialog/googletoken.service';
import { UserService } from '../authent/user.service';
import { HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(...registerables, annotationPlugin);

@Component({
  selector: 'app-congestion',
  templateUrl: './congestion.component.html',
  styleUrl: './congestion.component.css'
})
export class CongestionComponent implements OnInit {
    googletoken: string | null = null;
    private tokenSubscription!: Subscription;
    token: string | null = null;
    headers: Record<string, string> = {};
    freeSlots: string[][] = [];
    events:  any[]=[];
    datetimes: [string[], string[]] = [[], []];
    restaurant: number[] = [];
    line: number[] = [];
    delay: number = 0;
    date = new Date();
    dateString = this.date.toLocaleString('en-US', { timeZone: 'Europe/Athens', timeZoneName: 'short' });
    timeZoneOffset = `+0${this.dateString.substring(this.dateString.length-1, this.dateString.length)}:00`;
    currentTime = this.getCurrentTimeInAthensFormat();
    private intervalId: any;
    private chartInstances: { [key: string]: any } = {};

    constructor(
        private userService: UserService,
        private googleTokenService: GoogleTokenService,
        private router: Router,
        private spotDataService: SpotDataService
    ) {}

    ngOnDestroy(): void {
        this.tokenSubscription.unsubscribe();
    }

    updateRestaurantCapacity(restaurant: [{ x: Date; y: number }[],{ x: Date; y: number }[]], line: [{ x: Date; y: number }[],{ x: Date; y: number }[]]): void {
        const Restaurant: { x: Date; y: number }[] = restaurant[0].concat(restaurant[1]);
        const Line: { x: Date; y: number }[] = line[0].concat(line[1]);

        const total: { x: Date, y: number }[]=[];
        const minDate = (restaurant[0][restaurant[0].length -1].x).getTime < (line[0][line[0].length -1].x).getTime ? restaurant[0][restaurant[0].length -1].x : line[0][line[0].length -1].x;


        for (let i=0; i<Line.length; i++){
            if (Restaurant[i] && Line[i])
            if (Restaurant[i].x === Line[i].x){
                total.push({ x: Restaurant[i].x, y: Restaurant[i].y+ Line[i].y})}
        }
        
        const max = total.reduce((max, point) => 
            point.y > max.y ? point : max, total[0]
        );
        
        if (max.y > 0) {
            const percentage = parseFloat(
                (100 *(restaurant[0][restaurant[0].length -1].y+line[0][line[0].length -1].y)/max.y).toFixed(0)
            );
            const capacityBar = document.getElementById('capacity-bar');
            if (capacityBar!=null){
                capacityBar.style.width = percentage + '%';
            }
        
            const capacityText = document.getElementById('current_Capacity');
            if (capacityText!=null){
                capacityText.textContent = percentage + '%';
            }
        } else {
            console.error("Max capacity is zero, cannot calculate percentage.");
        }
        
    }

    delaymarker(markers: { x: Date; y: number }[]): { x: Date; y: number }[] {
        return markers.map(markr => {
            const m=new Date(markr.x);
            const newX = new Date(m.getTime() - this.delay*1000);
    
            return {
                x: newX, 
                y: 0,    
            };
        });
    }
    addelay(dateStr:string, delay: number):string{

        let enddateTime0 = new Date(dateStr);
    
        enddateTime0.setTime(enddateTime0.getTime() + delay);
        const year = enddateTime0.getFullYear();
        const month = String(enddateTime0.getMonth() + 1).padStart(2, '0');
        const day = String(enddateTime0.getDate()).padStart(2, '0');
        const hours = String(enddateTime0.getHours()).padStart(2, '0');
        const minutes = String(enddateTime0.getMinutes()).padStart(2, '0');
        const seconds = String(enddateTime0.getSeconds()).padStart(2, '0');
    
        const athensTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${this.timeZoneOffset}`;
        return athensTime
    }
    getCurrentTimeInAthensFormat(): string {
        const date = new Date();
      
        
        const options: Intl.DateTimeFormatOptions = {
          timeZone: 'Europe/Athens',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23', 
        };
      
        const athensDateParts = new Intl.DateTimeFormat('sv-SE', options).formatToParts(date);
        
        const year = athensDateParts.find(part => part.type === 'year')?.value;
        const month = athensDateParts.find(part => part.type === 'month')?.value;
        const day = athensDateParts.find(part => part.type === 'day')?.value;
        const hour = athensDateParts.find(part => part.type === 'hour')?.value;
        const minute = athensDateParts.find(part => part.type === 'minute')?.value;
        const second = athensDateParts.find(part => part.type === 'second')?.value;
        return `${year}-${month}-${day}T${hour}:${minute}:${second}${this.timeZoneOffset}`;
    }

    convenientTimes( waitingline: { x: Date; y: number }[]):{ x: Date; y: number }[]{
        const lunch= [];
        const dinner =[];
        for (let i = 0; i < this.freeSlots.length; i++){
            const [startDateStr, endDateStr] = this.freeSlots[i];
            const startDate = `${startDateStr.substring(6, 10)}-${startDateStr.substring(3, 5)}-${startDateStr.substring(0, 2)}T${startDateStr.substring(12, startDateStr.length)}${this.timeZoneOffset}`;
            const endDate = `${endDateStr.substring(6, 10)}-${endDateStr.substring(3, 5)}-${endDateStr.substring(0, 2)}T${endDateStr.substring(12, endDateStr.length)}${this.timeZoneOffset}`;
            
            const currentTime = this.getCurrentTimeInAthensFormat()
            
            if(startDate<`${currentTime.substring(0,10)}T17:00:00${this.timeZoneOffset}`){
                lunch.push([startDate,endDate])
            }else{
                dinner.push([startDate, endDate])
            }
        }
        
        const markers: { x: Date; y: number }[] = [];
        
        for (let meal of [lunch, dinner]){
            let minYPoint: { x: Date; y: number }[] = [];
            
            for(let i=0; i<meal.length; i++){
                const normalizeToUTC = (date: Date) => new Date(date.toISOString()); 

                const startTime = normalizeToUTC(new Date(meal[i][0]));
                const endTime = normalizeToUTC(new Date(meal[i][1]));

                const subwl = waitingline.filter(point => 
                    normalizeToUTC(new Date(point.x)) >= startTime &&
                    normalizeToUTC(new Date(point.x)) <= endTime
                );

                
                if (subwl[0]){
                    minYPoint.push(subwl.reduce((min, point) => 
                        point.y < min.y ? point : min, subwl[0]
                    ))
                }
                
            }
            
            if (minYPoint.length > 0) {
                const minY = minYPoint.reduce((min, point) => 
                    point.y < min.y ? point : min, minYPoint[0]
                );
                markers.push(minY);
            }
        }
        
        return markers;
    }

    plotTimeSeriesData(
        chart_name: string,
        animation_duration: number,
        y_title: string,
        recorded: { x: Date; y: number }[],
        projected: { x: Date; y: number }[],
        markr: { x: Date; y: number }[],
        markers: { x: Date; y: number }[]
    ): void {

        if (this.chartInstances[chart_name]) {
        this.chartInstances[chart_name].destroy();
    }
        const current_measurement = recorded[recorded.length - 1];
        
        
        const ctx = document.getElementById(chart_name) as HTMLCanvasElement;
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: "Current",
                        data: [current_measurement],
                        borderColor: 'rgba(25, 135, 214, 0.9)',
                        backgroundColor: 'rgba(25, 135, 214, 0.9)',
                        fill: false,
                        pointRadius: 5,
                        pointHoverRadius: 10
                    },
                    {
                        label: 'Recorded',
                        data: recorded,
                        borderColor:  'rgba(93, 158, 204, 0.9)', 
                        fill: true,
                        backgroundColor: 'rgba(101, 133, 157, 0.3)',
                        pointRadius: 0,
                    },
                    {
                        label: 'Projected',
                        data: projected,
                        borderColor: 'rgba(128, 128, 128, 0.5)',
                        fill: true,
                        backgroundColor: "rgba(128, 128, 128, 0.2)",
                        pointRadius: 0,
                    },
                    {
                        label: `Best dining time`,
                        data: markers,
                        borderColor: 'rgb(158, 232, 48)',
                        backgroundColor: 'rgb(158, 232, 48)',
                        fill: false,
                        pointRadius: 4.5,
                        pointHoverRadius: 8,
                        showLine: false
                    },
                    {
                        label: `Walking to restaurant`,
                        data: markr,
                        borderColor: 'rgb(172, 104, 235)',
                        backgroundColor:'rgb(172, 104, 235)', 
                        fill: false,
                        pointRadius: 4.5,
                        pointHoverRadius: 8,
                        showLine: false
                    },
                ]
            },
            options: {
                plugins: {
                    legend: {
                        display: true 
                    }
                },
                scales: {
                    x: {
                        type: 'time', 
                        time: {
                            unit: 'minute', 
                            tooltipFormat: 'MMM D, h:mm a', 
                            displayFormats: {
                                minute: 'h:mm a', 
                                hour: 'h:mm a'
                            }
                        },
                        ticks: {
                            stepSize: 60, 
                            callback: function (value) {
                                const date = new Date(value);
                                return date.toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hourCycle: 'h23'
                                });
                            }
                        }
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
        this.chartInstances[chart_name] = chart;
    }

    async fetchWalkDuration(): Promise<any> {
        try {
            const headers = new HttpHeaders({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
              });
          
              const headersObj: Record<string, string> = {};
              headers.keys().forEach((key) => {
                headersObj[key] = headers.get(key) || '';
              });
          const response = await fetch('https://localhost:5000/walk_to_destination', {
            method: 'POST',
            headers: headersObj,
            body: JSON.stringify({ location }),
          });
          if (!response.ok) {
            throw new Error('Failed to fetch duration');
          }
          const data = await response.json();
          return data.duration; 
        } catch (error) {
          console.error('Error fetching walk duration:', error);
        }
    }   

    async listCalendarEvents(accessToken: string, startDateTime: string, endDateTime: string): Promise<any[]> {
        try {
          const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(startDateTime)}&timeMax=${encodeURIComponent(endDateTime)}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
      
          if (!response.ok) {
            throw new Error('Failed to fetch calendar events');
          }
      
          const data = await response.json();
          return data.items || [];  
        } catch (error) {
          console.error('Error listing calendar events:', error);
          return []; 
        }
    }

    async initializeGisClient(): Promise<void>{
        
            this.freeSlots=[];
            this.delay = await this.fetchWalkDuration();
            const eating_time = 25*60*1000;
            const startDateTime = [this.addelay(`${this.currentTime.substring(0,10)}T12:00:00${this.timeZoneOffset}`, -this.delay*1000),this.addelay(`${this.currentTime.substring(0,10)}T19:00:00${this.timeZoneOffset}`, -this.delay*1000)];
            const endDateTime = [this.addelay(`${this.currentTime.substring(0,10)}T16:00:00${this.timeZoneOffset}`, -this.delay*1000), this.addelay(`${this.currentTime.substring(0,10)}T21:00:00${this.timeZoneOffset}`, -this.delay*1000)];
            
            if(this.currentTime>startDateTime[0]&&this.currentTime<endDateTime[0]){
                startDateTime[0] =this.currentTime;
            }
            if(this.currentTime<endDateTime[0]){
                if (this.googletoken!==null) {
                    this.events = await this.listCalendarEvents(this.googletoken, startDateTime[0], this.addelay(endDateTime[0],2*this.delay*1000+ eating_time));
                }
                this.findtimeslots(this.events, startDateTime[0], this.addelay(endDateTime[0],2*this.delay*1000+ eating_time), this.delay, eating_time);
            }
            if(this.currentTime>startDateTime[1]&&this.currentTime<endDateTime[1]){
                startDateTime[1] =this.currentTime;
            }
            if(this.currentTime<endDateTime[1]){
                if (this.googletoken!==null) {
                    this.events = await this.listCalendarEvents(this.googletoken, startDateTime[1], this.addelay(endDateTime[1],2*this.delay*1000+ eating_time));
                }
                this.findtimeslots(this.events, startDateTime[1], this.addelay(endDateTime[1],2*this.delay*1000+ eating_time), this.delay, eating_time);
            }
            
    }

    findtimeslots(events: any[], startDateTime: string, endDateTime: string, delay: number, eating_time: number): string[][] {
        const formatter = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/Athens',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      
        events.sort((a, b) => {
          const startA = new Date(a.start.dateTime).getTime();
          const startB = new Date(b.start.dateTime).getTime();
          return startA - startB;
        });     
        let lastEndTime = new Date(startDateTime).getTime();
      
        for (const event of events) {
          const eventStart = new Date(event.start.dateTime).getTime();
          if (eventStart - lastEndTime >= 2*delay*1000 +eating_time) {
            this.freeSlots.push(
              [`${formatter.format(new Date(lastEndTime +delay*1000 ))}`,`${formatter.format(new Date(eventStart -delay*1000 -eating_time))}`]
            );
          }
          lastEndTime = new Date(event.end.dateTime).getTime();
        }
      
        const endPeriodTime = new Date(endDateTime).getTime();
        if (endPeriodTime - lastEndTime >=2*delay*1000 +eating_time) {
          this.freeSlots.push(
            [`${formatter.format(new Date(lastEndTime +delay*1000 ))}`,`${formatter.format(new Date(endPeriodTime-delay*1000 -eating_time))}`]
          );
        }
        return this.freeSlots;
    }

      
    async ngOnInit(): Promise<void> {
        this.token = this.userService.getToken();
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
        this.loadSpotData();
        this.tokenSubscription = this.googleTokenService.tokenG$.subscribe(async(tokenG$) => {
            this.googletoken = tokenG$;
            if (this.googletoken)
                this.loadSpotData();
        });
        this.intervalId = setInterval(() => {
            this.loadSpotData();
        }, 600000);
    }
    
    
    async loadSpotData(): Promise<void> {
        this.currentTime = this.getCurrentTimeInAthensFormat();
        await this.initializeGisClient();
        this.spotDataService.getSpotData().subscribe(async data => {
            if (!this.freeSlots || !this.delay) {
                console.warn("freeSlots or delay is not set yet!");
            }
            
            const markers =this.convenientTimes(data['line'][1]);
            const marks = this.delaymarker(markers);
            
            const rest_markers = markers.map(marker => 
                data['restaurant'][1].filter((point: any )=> new Date(point.x).getTime() === new Date(marker.x).getTime())
            ).flat();
            this.plotTimeSeriesData('restaurantSizeChart', 700, 'Restaurant (People)', data['restaurant'][0], data['restaurant'][1], marks, rest_markers);
            this.plotTimeSeriesData('lineSizeChart', 1400, 'Queue Length (People)', data['line'][0], data['line'][1], marks, markers);
            
            this.updateUIWithCurrentData(data['restaurant'], data['line']);
            this.updateRestaurantCapacity(data['restaurant'], data['line']);
            
        });
    }
    
    private updateUIWithCurrentData(restaurantSizeData: [{ x: Date; y: number }[], { x: Date; y: number }[]], lineSizeData: [{ x: Date; y: number }[], { x: Date; y: number }[]]): void {
        const lastRestaurantSize = restaurantSizeData[0][restaurantSizeData[0].length - 1].y;
        const lastLineSize = lineSizeData[0][lineSizeData[0].length - 1].y;
    
        document.getElementById('current_WaitTime')!.textContent = lastRestaurantSize.toString();
        document.getElementById('current_LineSize')!.textContent = lastLineSize.toString();
    }
}
        