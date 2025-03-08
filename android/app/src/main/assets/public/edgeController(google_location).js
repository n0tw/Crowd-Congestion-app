const express = require('express');
//const mysql = require('mysql2');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const pool = require('./db');
const axios = require('axios');


const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;
const MONGODB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'mongooo';

let db, locsCollection, historyCollection;
const tables =["default_WeatherObserved_Wind_1_WeatherObserved", "default_WeatherObserved_Wind_2_WeatherObserved", "default_WeatherObserved_Atmospheric_1_WeatherObserved", "default_WeatherObserved_Atmospheric_2_WeatherObserved", "default_NoiseLevelObserved_1_NoiseLevelObserved", "default_NoiseLevelObserved_2_NoiseLevelObserved"];
const CLIENT_ID = '260243600706-e5u8mdaiap2q54eo9frj7r40lnjnq2ro.apps.googleusercontent.com';
const APIKEY = 'AIzaSyDD7kMR3hUWEaT5fDYqCGxHW1MwuVVUdLc';
const { OAuth2Client } = require('google-auth-library');
const { duration } = require('moment');
const client = new OAuth2Client(CLIENT_ID);
let location ;
let storedToken = null;

tables.forEach(table => {
    app.get(`/api/${table}` , (req, res) => {
        //console.log(`/api/${table}`);
        const query = `SELECT * FROM ${table}`;
        
        pool.query(query, (error, results) => {
          if (error) {
            res.status(500).send(error);
            console.log(error)
          } else {
            console.log(results);
            res.json(results);
          }
        });
    });
});

/* app.post('/api/cl-id', async (req, res) => {
    const { client_id } ='260243600706-e5u8mdaiap2q54eo9frj7r40lnjnq2ro.apps.googleusercontent.com';
    try {
      
        
    } catch (error) {
      console.error('Error validating Google token:', error);
      res.status(400).json({ success: false, message: 'Invalid token' });
    }
}); */

async function verifyToken(idToken) {
    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: CLIENT_ID, // Specify the client ID of the app that accesses the backend
        });
        const payload = ticket.getPayload();
        //console.log("User information:", payload);
        // Now you can access user's info (e.g., payload.email) and handle login/signup logic here
        return payload;
    } catch (error) {
        console.error("Error verifying ID token:", error);
        throw new Error("Invalid ID token");
    }
}
app.post('/verify-token', async (req, res) => {
    const { idToken } = req.body;
    try {
        const userInfo = await verifyToken(idToken);
        storedToken = token;
        res.status(200).json({ success: true, user: userInfo });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid ID token' });
    }
});

app.get('/credentials', (req, res) => {
    res.json({ client_id: CLIENT_ID, apiKey:APIKEY });
});

app.get('/api/token', (req, res) => {
    if (storedToken) {
        res.json({ token: storedToken });
    } else {
        res.status(404).json({ success: false, message: 'No token available' });
    }
});

app.get('/walk_to_eat', async (req, res) => {
    const duration =await walk_to_eat()
    if (duration) {
        //console.log("duration", duration);
        res.json({ duration: duration });
    } else {
        res.status(404).json({ success: false, message: 'No token available' });
    }
});

async function walk_to_eat() {
    const destination ="38.28548964325511,21.789290308162247";
    const origin = `${location.lat},${location.lng}`;
    let durationList=[];
    try {
        //console.log("location", destination, origin);
        const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=walking&key=${APIKEY}`);
        const data = await response.json();
        //console.log("DAta", data.status,data);
        if (data.status === "OK") {
            //console.log("data.routes",data.routes[0].legs[0].duration.value);
            data.routes.forEach((route, index) => {
                durationList.push(data.routes[0].legs[0].duration.value);
            })
            //console.log("walk_to_eat", durationList, Math.min(...durationList));
            return Math.min(...durationList);
        } else {
            console.error("Error in response:", data.status);
        }
    } catch (error) {
        console.error('Error fetching location:', error.message);
    }
}

async function walk_toStation(station,origin, destination) {
    try {
        const response = await fetch(`http://localhost:3000/googlemaps?origin=${origin}&destination=${destination}&mode=walking&key=${apiKey}`);
        const data = await response.json();
        
        if (data.status === "OK") {
            data.routes.forEach((route, index) => {
                durationList.push([station, data.routes[0].legs[0].duration.value]);
            })
    } else {
        console.error("Error in response:", data.status);
    }
    } catch (error) {
        console.error('Error fetching location:', error.message);
    }
}


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/api/spot-data', async (req, res) => {
    try {
        const response = await axios.get('http://127.0.0.1:2200/spot-data');
        
        if (response && response.data) {
            
            res.json(response.data); 
            console.log('Spot data:', response.data['line']);   
        } else {
            console.error('Unexpected response format:', response);
            res.status(500).json({ success: false, error: 'Unexpected response format' });
        }
    } catch (error) {
        console.error('Error fetching spot data from Flask:', error);
        
        if (error.response) {
            console.error('Server responded with a status:', error.response.status);
            console.error('Error response data:', error.response.data);
            res.status(error.response.status).json({ success: false, error: error.response.data });
        } else if (error.request) {
            console.error('No response received:', error.request);
            res.status(500).json({ success: false, error: 'No response received from Flask' });
        } else {
            console.error('Request setup error:', error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

async function nearbyLocations (lat, lng){

}

app.get('/api/nearby-locations', async (req, res) => {
    try {
        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
        }

        const nearbyLocations = await locsCollection.find({
            location: {
                $geoWithin: {
                    $centerSphere: [
                        [parseFloat(lng), parseFloat(lat)],  // Parse lat/lng as numbers
                        radiusInRadians
                    ]
                }
            }
        }).toArray();

        if (nearbyLocations.length === 0) {
            res.status(404).json({ success: false, message: 'No locations found within 3 meters' });
        } else {
            res.json({ success: true, locations: nearbyLocations });
        }
    } catch (error) {
        console.error('Error fetching nearby locations:', error);
        res.status(500).json({ success: false, message: 'Error fetching nearby locations', error: error.message });
    }
});




async function connectToDatabase() {
    const client = new MongoClient(MONGODB_URI );
    await client.connect();
    db = client.db(DB_NAME);
    locsCollection = db.collection('locs');
    historyCollection = db.collection('location_history');
}

connectToDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});

app.get('/sendlocation', async (req, res) => {
    try {
        const { lat, lng, timestamp, deviceId } = req.query;
        location = {lat,lng};
        const response = await anonymClientData(lat, lng, timestamp, deviceId);
        res.json({ success: true, response });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});



async function anonymClientData(lat, lng, timestamp, deviceId) {
    const entity_id = deviceId + timestamp;
    const timestamp_seconds = timestamp ? parseInt(timestamp) / 1000 : Date.now() / 1000;
    const date_time = new Date(timestamp_seconds * 1000);

    const formatted_date_time = [
        date_time.getFullYear(),
        date_time.getMonth() + 1,
        date_time.getDate(),
        date_time.getHours(),
        date_time.getMinutes(),
        date_time.getSeconds()
    ];

    //console.log("Formatted Date and Time:", formatted_date_time);

    await createEntity(entity_id, deviceId, lat, lng, formatted_date_time); 

    const entityExists = await checkEntityExists(deviceId);
    if (entityExists) {
        await updateEntity(entity_id, deviceId, lat, lng, formatted_date_time);
        //console.log("entity exists");
    }

    return "Location data recorded successfully";
}

async function checkEntityExists(deviceId) {
    const count = await locsCollection.countDocuments({ anonymizedId: deviceId });
    return count > 0;
}

async function updateEntity(entity_id, deviceId, lat, lng, timestamp) {
    await locsCollection.updateOne(
        { _id: entity_id },
        {
            $set: {
                location: { type: 'Point', coordinates: [lat, lng] },
                dateModified: { type: 'DateTime', value: timestamp }
            }
        }
    );

    const historyEntry = {
        _id: entity_id,
        anonymizedId: { type: 'Text', value: deviceId },
        type: 'AnonymousCommuterId',
        location: { type: 'Point', coordinates: [lat, lng] },
        dateCreated: { type: 'DateTime', value: timestamp }
    };
    await historyCollection.insertOne(historyEntry);

    return `Entity ${entity_id} updated with new location (${lat}, ${lng})`;
}

async function createEntity(entity_id, deviceId, lat, lng, timestamp) {
    //console.log("create entity");
    const acData = {
        _id: entity_id,
        anonymizedId: { type: 'Text', value: deviceId },
        type: 'AnonymousCommuterId',
        orig: { type: 'Text', value: 'City hall' },
        dest: { type: 'Text', value: 'Library' },
        location: { type: 'Point', coordinates: [lat, lng] },
        dateCreated: { type: 'DateTime', value: timestamp },
        dateModified: { type: 'DateTime', value: timestamp }
    };

    const historyEntry = {
        _id: entity_id,
        anonymizedId: { type: 'Text', value: deviceId },
        type: 'AnonymousCommuterId',
        location: { type: 'Point', coordinates: [lat, lng] },
        dateCreated: { type: 'DateTime', value: timestamp }
    };

    await locsCollection.insertOne(acData);
    await historyCollection.insertOne(historyEntry);

    return `New entity created with ID ${entity_id} and location (${lat}, ${lng})`;
}

