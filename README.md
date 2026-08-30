# Real-Time Smart Campus Crowd Monitoring & Prediction Platform

A **full-stack, real-time crowd monitoring and prediction platform** designed for smart-campus environments, with an architecture that can be extended to city-scale deployments.

The system combines **Wi-Fi Access Point connection data, GPS data, IoT sensor data, external APIs, and machine-learning-based crowd prediction** to provide real-time information about crowd levels and campus conditions through a Progressive Web App (PWA).

The platform was developed as my **Electrical & Computer Engineering thesis project at the University of Patras**.

## Key Features

* **Real-time crowd monitoring** using Wi-Fi Access Point connection data and GPS data collected through the PWA
* **Crowd forecasting** using an XGBoost machine-learning model
* **Persistent Areas of Interest (PAOI)** monitoring, including restaurants and bus stations
* **Interactive crowd heatmaps** for visualizing campus congestion
* **Progressive Web App (PWA)** for mobile and desktop devices
* **Real-time IoT sensor integration** using MQTT
* **Environmental monitoring** using real-time sensor data and Open-Meteo weather data
* **Campus bus tracking**, including route schedules and nearest-bus-station calculation
* **Personalized dining recommendations** based on predicted restaurant crowd levels and the user's Google Calendar availability
* **User authentication** using university credentials
* **Privacy-preserving user representation** using salted and peppered SHA-512 anonymization
* **Modular architecture** based on the FIWARE ecosystem
* **MySQL primary storage** with MongoDB used as a backup database
* Integration with external services through **REST APIs**
* Web scraping for retrieving real-time campus bus information

## Architecture

The system consists of several interconnected components:
<img width="992" height="662" alt="Screenshot 2026-08-30 160756" src="https://github.com/user-attachments/assets/b6ab34cc-cdde-43d6-be12-59753490955f" />

## Technology Stack

### Frontend

* Angular 15
* JavaScript / TypeScript
* Capacitor
* HTML / CSS

### Backend

* Python
* Node.js
* REST APIs

### Databases

* MySQL
* MongoDB

### IoT & Data Processing

* FIWARE
* MQTT
* Cygnus
* Wi-Fi sensing
* GPS

### Machine Learning

* XGBoost
* scikit-learn
* NumPy
* Pandas

### External Services

* Google Calendar API
* Open-Meteo API
* Web scraping for campus bus information

## My Contributions

I designed and implemented the system as a full-stack project, including:

* Development of the Progressive Web App for GPS acquisition and user-facing services
* Development of modular backend services using Python and Node.js
* Design and implementation of database interactions using MySQL and MongoDB
* Integration with the FIWARE ecosystem
* Real-time data processing using MQTT
* Integration of external APIs and web-scraped data sources
* Implementation of user authentication and privacy-preserving anonymization
* Development of real-time crowd monitoring functionality
* Implementation of crowd forecasting using XGBoost
* Development of data visualization and campus heatmaps
* Integration of Google Calendar data for personalized recommendations

## Privacy & Security

The system was designed to avoid directly storing identifiable user information.

User identities are transformed into unique representations using **SHA-512 with salt and pepper**, allowing the system to associate data with users while reducing exposure of their original university credentials.

## Running the Application

### Prerequisites

* Node.js
* Angular CLI
* Python
* Node.js backend dependencies
* MySQL
* MongoDB

### Frontend Development Server

Install the required dependencies and run:

```bash
ng serve
```

The application will be available at:

```text
http://localhost:4200/
```

### Production Build

```bash
ng build
```

The build artifacts are generated in the `dist/` directory.

## Project Context

This project was developed as my **Electrical & Computer Engineering thesis at the University of Patras**.

The system was designed around a university campus use case, while following principles of **modularity, scalability, real-time processing, API integration, and IoT interoperability** to allow future expansion toward smart-city environments.

## Future Improvements

Potential extensions include:

* Deployment on cloud infrastructure
* Containerization of individual services
* More advanced crowd prediction models
* Real-time streaming infrastructure for larger deployments
* Improved authentication and authorization mechanisms
* Automated deployment and CI/CD
* Expansion from campus-scale deployment to city-scale environments
* Integration with additional IoT data sources

## License

This project was developed for academic purposes.
