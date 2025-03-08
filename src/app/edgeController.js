const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const pool = require('./db');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const fs = require('fs');
const https = require('https');

const agent = new https.Agent({
    rejectUnauthorized: false
});  

const context_broker_url = "http://150.140.186.118:1026/v2/entities"
headers = {
    "Content-Type": "application/json",
    "Fiware-Service": "default",
    "Fiware-ServicePath": "/"
}

const { jwtVerify } = require('jose');

const AZURE_OPENID_CONFIG_URL = 'https://login.microsoftonline.com/5a52ab58-42d0-4bb4-b3fc-713dd6822d20/v2.0/.well-known/openid-configuration';
let publicKeysCache = null;

async function getAzurePublicKeys(forceRefresh = false) {
    if (!forceRefresh && publicKeysCache) {
        return publicKeysCache;
    }

    const { data } = await axios.get(AZURE_OPENID_CONFIG_URL);
    const jwksUri = data.jwks_uri;

    const { data: jwks } = await axios.get(jwksUri);
    publicKeysCache = jwks.keys;
    return jwks.keys;
}

async function verifyAzureToken(token) {
    try {
        const publicKeys = await getAzurePublicKeys();

        const [header] = token.split('.');
        const { kid } = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));

        let key = publicKeys.find(k => k.kid === kid);
        if (!key) {
            console.warn('No matching key found, refreshing keys.');
            key = (await getAzurePublicKeys(true)).find(k => k.kid === kid);
            if (!key) {
                throw new Error('Matching key not found in JWKS even after refresh');
            }
        }

        const { alg } = key;
        const jwk = { ...key, alg };

        const { payload } = await jwtVerify(token, jwk);
        console.log('Token verified successfully:', payload, payload["preferred_username"]);

        return payload["preferred_username"];
    } catch (error) {
        console.error('Error verifying Azure token:', error);
        throw error;
    }
}

const PORT = process.env.PORT || 5000;
const MONGODB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'mongooo';

let db, locsCollection, historyCollection;
const CLIENT_ID = '260243600706-e5u8mdaiap2q54eo9frj7r40lnjnq2ro.apps.googleusercontent.com';
const APIKEY = '****';
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(CLIENT_ID);
let storedToken = null;
const tables = ["environmental_Weather_Wind_WeatherObserved","environmental_Weather_Atmospheric_WeatherObserved", "environmental_NoiseLevel_NoiseLevelObserved"];    
tables.forEach(table => {
    app.get(`/api/${table}/:attrs/:startDate/:endDate`, async (req, res) => {
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return res.status(400).send('Authorization header missing');
        }
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.status(400).send('Token missing');
        }
        try {
            await verifyAzureToken(token);
        } catch (error) {
            return res.status(401).send('Token verification failed');
        }
        const { attrs, startDate, endDate } = req.params;
        const parsedAttrs = attrs.split(',');
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            return res.status(400).send('Invalid date format');
        }
        try {
            const queryPromises = parsedAttrs.map(attrName => {
                const query = `
                    SELECT * 
                    FROM ${table} 
                    WHERE recvTime BETWEEN ? AND ?
                    AND attrName = ?
                    ORDER BY recvTime
                `;
                return new Promise((resolve, reject) => {
                    pool.query(query, [startDateObj, endDateObj, attrName], (error, results) => {
                        if (error) {
                            reject(error);
                        } else {
                            const totalPoints = results.length;
                            const maxPoints = 30;

                            let sampledData = results;
                            if (totalPoints > maxPoints) {
                                const interval = Math.floor(totalPoints / maxPoints);
                                sampledData = results.filter((_, index) => index % interval === 0).slice(0, maxPoints);
                            }
                            resolve(sampledData);
                        }
                    });
                });
            });

            const results = await Promise.all(queryPromises);
            const sData = results.flat();
            res.json(sData);

        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    });
});


async function verifyToken(idToken) {
    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: CLIENT_ID, 
        });
        const payload = ticket.getPayload();
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

app.get('/credentials', async (req, res) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(400).send('Authorization header missing');
    }
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(400).send('Token missing');
    }
    try {
        await verifyAzureToken(token);
    } catch (error) {
        return res.status(401).send('Token verification failed');
    }
    res.json({ client_id: CLIENT_ID, apiKey:APIKEY });
});

app.post('/dString', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(400).send('Token missing');
    }
    try {
        await verifyAzureToken(token);
    } catch (error) {
        return res.status(401).send('Token verification failed');
    }
    const date = new Date();
    const dateString = date.toISOString(); 
    const datee= dateString.substring(0, 10);
    const responseString = datee;
    res.json({ message: responseString });
});

app.post('/secretString', async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.status(400).send('Token missing');
        }
        try {
            await verifyAzureToken(token);
        } catch (error) {
            return res.status(401).send('Token verification failed');
        }
        const responseString = "dipp_iott_skyy";
        res.json({ message: responseString });
    } catch (error) {
        console.error("Error handling /secretString:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/token', (req, res) => {
    
    if (storedToken) {
        res.json({ token: storedToken });
    } else {
        res.status(404).json({ success: false, message: 'No token available' });
    }
});

app.post('/walk_to_destination', async (req, res) => {
    const authHeader = req.headers['authorization'];
    console.log('Authorization Header:', authHeader);

    if (!authHeader) {
        return res.status(400).send('Authorization header missing');
    }
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(400).send('Token missing');
    }
    try {
        await verifyAzureToken(token);
    } catch (error) {
        return res.status(401).send('Token verification failed');
    }
    console.log(req.body); 
    const {location} = req.body
    const duration =await walk_to_destination(location)
    if (duration) {
        console.log("duration", duration);
        res.json({ duration: duration });
    } else {
        res.status(404).json({ success: false, message: 'No token available' });
    }
});

async function walk_to_destination(location) {
    console.log("llloooo",location);
    const destination ="38.28548964325511,21.789290308162247";
    const origin ='38.288646988206736, 21.789450937138188';
    let durationList=[];
    try {
        const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=walking&key=${APIKEY}`);
        const data = await response.json();
        if (data.status === "OK") {
            data.routes.forEach(() => {
                durationList.push(data.routes[0].legs[0].duration.value);
            })
            return Math.min(...durationList);
        } else {
            console.error("Error in response:", data.status);
        }
    } catch (error) {
        console.error('Error fetching location:', error.message);
    }
}


app.post('/walk_toStation', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(400).send('Token missing');
    }
    try {
        await verifyAzureToken(token);
    } catch (error) {
        return res.status(401).send('Token verification failed');
    }
    const origin =[38.28770528788744, 21.787230772372478];
    const stations = [ [38.2862010182659, 21.786049311954574],[ 38.28797289197418, 21.78652843601951],[38.28977270490379, 21.78496964937884],[38.291728745799944, 21.786964884964515],[38.293692807759314, 21.790486853464568],[38.2944747805789, 21.791867835799813],[ 38.296388013644, 21.794956024153628]];
    let index=0;
    let min = Infinity;
    let distance;
    for (i=0; i< stations.length; i++){
        distance = await walk_toStation(origin,stations[i])
        if(min> distance){
            min = distance;
            index = i;
        }
    }
    console.log("index", index);
    res.json({ index: index });
});
async function walk_toStation(origin, destination) {
    let durationList=[];
    try {
        const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=walking&key=${APIKEY}`);
        const data = await response.json();
        
        if (data.status === "OK") {
            data.routes.forEach(() => {
                durationList.push(data.routes[0].legs[0].duration.value);
            })
        return Math.min(...durationList);
    } else {
        console.error("Error in response:", data.status);
    }
    } catch (error) {
        console.error('Error fetching location:', error.message);
    }
}


app.get('/api/spot-data', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return res.status(400).send('Authorization header missing');
        }
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.status(400).send('Token missing');
        }
        try {
            await verifyAzureToken(token);
        } catch (error) {
            return res.status(401).send('Token verification failed');
        }
        const response = await axios.get('https://127.0.0.1:2200/spot-data', { httpsAgent: agent,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
         });

        if (response && response.data) {
            res.json(response.data);
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

async function all_app_data() {
    try {
        const currentTime = new Date();
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const historyCollectionArray = await historyCollection
            .aggregate([
                {
                    $match: {
                        "dateCreated.value": { $gte: fiveMinutesAgo, $lte: currentTime },
                        "connectionType.value": { $ne: "wifi" } 
                    }
                },
                {
                    $group: {
                        _id: "$owner.value", 
                        latestEntry: { $last: "$$ROOT" } 
                    }
                },
                {
                    $replaceRoot: { newRoot: "$latestEntry" }
                }
            ])
            .toArray();

        const appdata = historyCollectionArray.map(item => ({
            location: item.location.value.coordinates,
            crowd_size: 1
        }));

        return appdata;
    } catch (error) {
        console.error("Error in app_users:", error);
    }
}


app.get('/api/all-data', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(400).send('Authorization header missing');
        }
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.status(400).send('Token missing');
        }
        try {
            await verifyAzureToken(token);
        } catch (error) {
            return res.status(401).send('Token verification failed');
        }
        const response = await axios.get('https://127.0.0.1:2200/all-data', { httpsAgent: agent,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        appdata = await all_app_data();

        if (response && response.data) {
            
            allofdata=response.data;
            r=appdata
            allofdata.forEach( datapoint=>{
                if(datapoint.location=='Restaurant')
                    datapoint['location']=[38.28590086740034, 21.78940532544933]
                else if (datapoint.location=='Waiting Area')
                    datapoint['location']=[38.28603963480802, 21.78996141021614]
                r.push(datapoint)
            });
            res.json(r);
        } else {
            console.error('Unexpected response format:', response);
            res.status(500).json({ success: false, error: 'Unexpected response format' });
        }
    } catch (error) {
        console.error('Error fetching all data with a status:', error);
        console.error('Error response data:', error.response.data);
            
    }
});

async function checkAndCreateCollection(db, collectionName) {
    try {

        const collections = await db.listCollections({ name: collectionName }).toArray();
        
        if (collections.length > 0) {
            console.log(`Collection "${collectionName}" already exists.`);
        } else {
            await db.createCollection(collectionName);
            console.log(`Collection "${collectionName}" created.`);
        }
    } catch (error) {
        console.error("Error:", error);}
}


function getresponse(entities, duration){

    const now = new Date().getTime();
    const res =[];
    i =0;
    for(let time= now - duration + 5* 60 * 1000; time<= now; time += 5* 60*1000){
        const filteredEntities = entities.filter(item => {
            const itemTime = item.dateCreated.value.getTime();
            return itemTime > time - 5 * 60 * 1000 && itemTime < time;
        });
        const uniqueEntities = {};
        filteredEntities.forEach(doc => {
            const owner = doc.owner.value;
            if (!uniqueEntities[owner]) {
                uniqueEntities[owner] = doc; 
            }
        });
        const uniqueResults = Object.values(uniqueEntities);


        // console.log("ddddddd",i,uniqueResults);
        console.log("aaaa", new Date(time- 5* 60 * 1000), new Date(time))
        if (uniqueResults.length>0){
            res.push( {datetime:new Date(time- 5* 60 * 1000), value: uniqueResults.length});
            console.log("logggggggg");
        }else{
            res.push({datetime:new Date(time- 5* 60 * 1000), value: 0})
        }
        
    }
    return res
}

app.get('/waiting_at_location', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return res.status(400).send('Authorization header missing');
        }
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.status(400).send('Token missing');
        }
        try {
            await verifyAzureToken(token);
        } catch (error) {
            return res.status(401).send('Token verification failed');
        }
        const { lat, lng, duration} = req.query;
        const location = [Number(lat), Number(lng)]
        const durationvalue= Number(duration);

        if (!location||!duration) {
            console.error("Missing required query parameters:", { location });
            return res.status(400).json({ success: false, error: "Missing location" });
        }

        await historyCollection.createIndex({ "location.value.coordinates": "2dsphere" });
        const result = await findEntByTAndL(location, durationvalue);
        let response;
        if (result.length>0){
            response = getresponse(result, durationvalue);
        }else{
            response = []
        }
        console.log("response", new Date(), response);
        res.json( response );
    } catch (error) {
        console.error("Error handling /waiting_at_location:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

async function findEntitiesByTimeAndLocation(startTime, endTime, location, maxDistanceInMeters) {
    const startDate = new Date(startTime);  
    const endDate = new Date(endTime);
    const results = await historyCollection.find({
        "dateCreated.value": { $gte: startDate, $lte: endDate },
        "location.value.coordinates": {
            $near: {
                $geometry: { type: "Point", coordinates: location },
                $maxDistance: maxDistanceInMeters
            }
        },
        "connectionType.value": { $ne: "wifi" }
    }).sort({ "dateCreated.value": 1 }).toArray();

    return results;
}



async function findEntByTAndL(location, duration) {
    try {
        
        const maxDistance = 100; 

        const now = new Date();
        const end = now.getTime();
        const start = now.getTime()- duration;

        const results = await findEntitiesByTimeAndLocation(
            start,
            end,
            location,
            maxDistance
        );

        console.log("Matching entities:", results);
        return results;
    } catch (err) {
        console.error("Error searching entities:", err);
    }
}


async function connectToDatabase() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        const collections = await db.listCollections().toArray();
        console.log("Collections in database:", collections);

        await checkAndCreateCollection(db, 'locs');
        await checkAndCreateCollection(db, 'location_history');

        locsCollection = db.collection('locs');
        historyCollection = db.collection('location_history');
        

        await historyCollection.updateMany(
            { "location.value.coordinates": { $type: "string" } },
            [
                { $set: { 
                    "location.value.coordinates": [
                        { $toDouble: { $arrayElemAt: ["$location.value.coordinates", 0] } },
                        { $toDouble: { $arrayElemAt: ["$location.value.coordinates", 1] } }
                    ]
                }}
            ]
        );
        const sampleDocs = await locsCollection.find({}).limit(10).toArray();
        const filePath = './locsDocuments.json';
        fs.writeFileSync(filePath, JSON.stringify(sampleDocs, null, 2), 'utf-8');
    } catch (error) {
        console.error("Error connecting to the database:", error);
        process.exit(1);
    }
}


connectToDatabase().then(() => {
    const options = {
        key: fs.readFileSync('C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.key'),
        cert: fs.readFileSync('C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.crt'),
    };
    const httpsServer = https.createServer(options, app);
    httpsServer.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
    });
});

app.get("/ping", (req, res) => {
    res.send("OK"); 
});
async function sendlocation(payload, locationData, res) {
    const { lat, lng, accuracy, timestamp, deviceId, connectionType, speed, networks } = locationData;

    if (!lat || !lng || !accuracy || !timestamp || !deviceId || !connectionType) {
        console.error("Missing required location data:", { lat, lng, accuracy, timestamp, deviceId, connectionType });
        return res.status(400).json({ success: false, error: "Missing required location data" });
    }

    const response = await anonymClientData(payload, lat, lng, accuracy, timestamp, deviceId, connectionType, speed);
    if (response) {
        console.log("Data found:", response);
    } else {
        console.log("No data found for the given parameters");
    }

    return response ;
}


app.post('/sendlocation', async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        console.log("/sendlocation token", token);
        if (!token) {
            return res.status(400).send('Token missing');
        }
        let payload = null;
        
        try {
            console.log("verifyAzureToken(token)");
            payload =await verifyAzureToken(token);
            console.log("payload", payload)
            
            
        } catch (error) {
            return res.status(401).send('Token verification failed');
        }
        const { lat, lng, accuracy, timestamp, deviceId,  connectionType, speed, networks } = req.body;
        console.log("Received location data:", { lat, lng, accuracy, timestamp, deviceId, connectionType, speed, networks });

        if (!lat || !lng || !accuracy || !timestamp || !deviceId ||   !connectionType ) {
            console.error("Missing required query parameters:", { lat, lng, timestamp, deviceId , connectionType});
            return res.status(400).json({ success: false, error: "Missing required query parameters" });
        }else{
            let response =await sendlocation(payload, req.body, res)
            return res.json({ success: true, response });
        }

    } catch (error) {
        console.error("Error handling /sendlocation:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/sendlocationfromfaker', async (req, res) => {
    try {

        const { lat, lng, accuracy, timestamp, deviceId,  connectionType, speed, networks } = req.body;
        console.log("Received location data:", { lat, lng, accuracy, timestamp, deviceId, connectionType, speed, networks });

        if (!lat || !lng || !accuracy || !timestamp || !deviceId ||   !connectionType ) {
            console.error("Missing required query parameters:", { lat, lng, timestamp, deviceId , connectionType});
            return res.status(400).json({ success: false, error: "Missing required query parameters" });
        }else{
            const payload = deviceId
            let response =await sendlocation(payload, req.body, res)
            return res.json({ success: true, response });
        }
    } catch (error) {
        console.error("Error handling /sendlocation:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


function hash_func(date, data){
    initial_string = date+ String(data)
    const hash1 = crypto.createHash('sha512').update(initial_string).digest('hex');
    combined_string = hash1 + initial_string
    final_string = combined_string + "dipp_iott_skyy";
    const final_hash = crypto.createHash('sha512').update(final_string).digest('hex');
    return ""+String(final_hash)
};

async function anonymClientData(payload, lat, lng, accuracy, timestamp, deviceId, connectionType, speed=0) {
    const date = new Date();
    const dateString = date.toISOString(); 
    const datee= dateString.substring(0, 10);

    const hashed_email= hash_func(datee, payload);
    const entityExists = await locsCollection.countDocuments({ 'id':'ACI'+ hashed_email });
    if (entityExists) {
        await updateEntity(hashed_email, deviceId, lat, lng, accuracy, new Date(new Number(timestamp)), connectionType, speed);
        
    }else{
        await createEntity(hashed_email, deviceId, lat, lng, accuracy, new Date(new Number(timestamp)), connectionType, speed);
    }

    return "Location data recorded successfully";
}



async function updateEntity(hashed_email, entity_id, lat, lng, accuracy, timestamp, connectionType, speed=0) {
    await locsCollection.updateOne(
        { "id": "ACI"+hashed_email },
        {
            $set: {
                "owner": { "type": "Text", "value": hashed_email},
                "location": { "type": "geo:json", "value": {"type": "Point", "coordinates": [parseFloat(lat), parseFloat(lng)] }},
                "speed": {"type": "Number", "value": speed},
                "connectionType": { "type": "Text", "value": connectionType},
                "dateModified":{ "type": 'DateTime', "value": timestamp }
            }
        }
    );
    const entityData={
        "anonymizedId": { "type": "Text", "value": entity_id },
        "owner": { "type": "Text", "value": hashed_email},
        "location": { "type": "geo:json", "value": {"type": "Point", "coordinates": [parseFloat(lat), parseFloat(lng)] }},
        "speed": {"type": "Number", "value": speed},
        "connectionType": { "type": "Text", "value": connectionType},
        "dateModified":{ "type": 'DateTime', "value": timestamp }
    }
    
    const historyEntry = {
        "id": "ACI"+hashed_email,
        "anonymizedId": { "type": "Text", "value": entity_id },
        "type":  "AnonymousCommuterId" ,
        "owner": { "type": "Text", "value": hashed_email},
        "location": { "type": "geo:json", "value": {"type": "Point", "coordinates": [parseFloat(lat), parseFloat(lng)] }},
        "speed": {"type": "Number", "value": speed},
        "connectionType": { "type": "Text", "value": connectionType},
        "dateCreated": { "type": 'DateTime', "value": timestamp }
    };
    
    await historyCollection.insertOne(historyEntry);
    const payload = JSON.stringify(entityData);
    try {
        const response = await axios.patch(`${context_broker_url}/ACI${hashed_email}/attrs`, payload, { headers });
        if ([200, 201, 204].includes(response.status)) {
            console.log("Entity updated successfully in the context broker");
            console.log(`Entity ID: ACI${hashed_email}`);
        } 
    } catch (error) {
        if(error.response.status==404){
            postoCB(hashed_email, entity_id, lat, lng, speed, connectionType, timestamp);
        } else {
            console.error("Error while updating entity:", error.message, entity_id);
            if (error.response) {
                console.error(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
            }
        }
    }

    return `Entity ${entity_id} updated with new location (${lat}, ${lng})`;
}


async function createEntity(hashed_email, entity_id, lat, lng, accuracy, timestamp, connectionType, speed=0) {
    const acData = {
        "id": "ACI"+hashed_email,
        "anonymizedId": { "type": "Text", "value": entity_id },
        "owner": { "type": "Text", "value": hashed_email},
        "type": "AnonymousCommuterId" ,
        "location": { "type": "geo:json", "value": {"type": "Point", "coordinates": [parseFloat(lat), parseFloat(lng)]}},
        "speed": {"type": "Number", "value": speed},
        "connectionType": { "type": "Text", "value": connectionType},
        "dateCreated": { "type": 'DateTime', "value": timestamp },
        "dateModified": { "type": 'DateTime', "value": timestamp }
    };
    const historyEntry = {
        "id": "ACI"+hashed_email,
        "anonymizedId": { "type": "Text", "value": entity_id },
        "owner": { "type": "Text", "value": hashed_email},
        "type":  "AnonymousCommuterId" ,
        "location": { "type": "geo:json", "value": {"type": "Point", "coordinates": [parseFloat(lat), parseFloat(lng)]} },
        "speed": {"type": "Number", "value": speed},
        "connectionType": { "type": "Text", "value": connectionType},
        "dateCreated": { "type": 'DateTime', "value": timestamp }
    };

    await locsCollection.insertOne(acData);
    await historyCollection.insertOne(historyEntry);

    // postoCB(hashed_email, entity_id, lat, lng, speed, connectionType, timestamp);
    
    const entityData={
        "anonymizedId": { "type": "Text", "value": entity_id },
        "owner": { "type": "Text", "value": hashed_email},
        "location": { "type": "geo:json", "value": {"type": "Point", "coordinates": [parseFloat(lat), parseFloat(lng)] }},
        "speed": {"type": "Number", "value": speed},
        "connectionType": { "type": "Text", "value": connectionType},
        "dateModified":{ "type": 'DateTime', "value": timestamp }
    }

    const payload = JSON.stringify(entityData);
    try {
        // Send a POST request to create a new entity
        const response = await axios.patch(`${context_broker_url}/ACI${hashed_email}/attrs`, payload, { headers });
        // console.log("response patch cb", response);
        if ([200, 201, 204].includes(response.status)) {
            console.log("Entity updated successfully in the context broker");
            console.log(`Entity ID: ACI${hashed_email}`);
        } 
        else if(response.status==404){
            postoCB(hashed_email, entity_id, lat, lng, speed, connectionType, timestamp);
        } else {
            console.error(`Failed to update entity: ${response.status}, ${response.statusText}`);
        }
    } catch (error) {
        console.log("typeof parseFloat(lat)",typeof parseFloat(lat),parseFloat(lat) );
        console.error("Error while creating entity:", error.message, entity_id);
        if (error.response) {
            console.error(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
        }
    }
    return `Checked or created entity with ID ${entity_id} and location (${lat}, ${lng})`;
}

async function postoCB(hashed_email, entity_id, lat, lng, speed, connectionType, timestamp){
    const acDataaa = {
        "id": "ACI"+hashed_email,
        "type":  "AnonymousCommuterId" ,
        "owner": { "type": "Text", "value": hashed_email},
        "anonymizedId": { "type": "Text", "value": entity_id },
        "location": {"type": "Point", "coordinates": [parseFloat(lat), parseFloat(lng)]},
        "speed": {"value": speed},
        "connectionType": {"value": connectionType},
        "dateCreated": {"value": timestamp },
        "dateModified": { "value": timestamp }
    };
    const payload = JSON.stringify(acDataaa);
    const context_broker_url = "http://150.140.186.118:1026/v2/entities";
    const get_headers = {
        "Accept": "application/json",
        "Fiware-Service": "default",
        "Fiware-ServicePath": "/"
    }; 
    const headers = {
        "Content-Type": "application/json",
        "Fiware-Service": "default",
        "Fiware-ServicePath": "/"
    }
    try {
        const entityUrl = `${context_broker_url}/ACI${entity_id}`;
        const getResponse = await axios.get(entityUrl, { get_headers });
        if (getResponse.status === 200) {
            console.log("Entity already exists in the Context Broker:", getResponse.data);
        }
    } catch (error) {
        if (error.response && error.response.status === 404) {
            try {
                const postResponse = await axios.post(`${context_broker_url}/?options=keyValues`, payload, { headers });
                if ([200, 201].includes(postResponse.status)) {
                    console.log("Entity created successfully in the Context Broker:", postResponse.data);
                } else {
                    console.error(`Failed to create entity: ${postResponse.status}, ${postResponse.statusText}`);
                }
            } catch (postError) {
                console.error("Error while creating entity:", postError.message);
                if (postError.response) {
                    console.error(`Status: ${postError.response.status}, Data: ${JSON.stringify(postError.response.data)}`);
                }
            }
        } else {
            console.error("Error while checking for entity existence:", error.message);
            if (error.response) {
                console.error(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
            }
        }
    }
    return;
}