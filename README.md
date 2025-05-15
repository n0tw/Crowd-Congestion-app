# Smart Campus PWA

This is a full-stack real-time **crowd monitoring system** designed for deployment in **smart campus** environments (Python, JavaScript), using **Wi-Fi Access Points** connection data and **GPS data from devices' sensors**. Includes a **Progressive Web App (PWA)** (Angular 15.2.9 and JavaScript) for GPS data retrieval and **user-facing services** for user incentivization.

## Features

- Real-time crowd detection and monitoring via Wi-Fi AP connection data and GPS data collected via PWA
- Responsive PWA designed for mobile and desktop offering useful services to encourage user participation
- System implemented around the FIWARE ecosystem
- Efficient data storage management with a primary MySQL database and a MongoDB backup
- Token-based authentication in the PWA using users’ university credentials
- User anonymity and unique representation ensured through SHA-512 anonymization with salt and pepper
- Heatmap, persistent areas of interest (PAOI) (e.g., restaurant, bus stations) crowd tracking
- crowd levels predictions in the restaurant area, using XGBoost
- Real-time environmental data collection via MQTT from deployed sensors
- integration of historical/forecasted temperature data from Open-Meteo APIs
- Real-time tracking of buses that stop at the campus bus stations through web scraping
- Calculation of the nearest bus station to the user while providing information about the bus routes schedules stopping at that station
- Calculation of optimal dining times, considering the user's Google Calendar schedule
- Display of additional information about the University’s daily menu and bus line schedules

## Required apps

Download and install Nodejs from the official Node.js website: https://nodejs.org/
Download Angular CLI from: https://github.com/angular/angular-cli

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
