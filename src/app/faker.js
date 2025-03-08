const express = require('express');
const axios = require('axios');
const ExcelJS = require('exceljs');
const PORT = process.env.PORT || 2000;
const app = express();
const fs = require('fs');
const https = require('https');
const cors = require('cors');
app.use(cors());
// const cert = fs.readFileSync('../assets/server.crt');

const agent = new https.Agent({
    rejectUnauthorized: false, // Ignore SSL validation
});

const options = {
    key: fs.readFileSync('C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.key'),
    cert: fs.readFileSync('C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.crt'),
};
const httpsServer = https.createServer(options, app);
httpsServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});


function getRandomInt(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1)) + minCeiled;
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  
  
  async function post(lat, lng, accuracy, anonymized_deviceId, connectionType, speed) {
      const now = new Date();
      const timestamp = now.getTime();
  
      try {
          const cert = fs.readFileSync('C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.crt');
          const agent = new https.Agent({
            rejectUnauthorized: false,
          });
  
          const response = await axios.post(
              'https://192.168.1.4:5000/sendlocationfromfaker',
              {
                  lat,
                  lng,
                  accuracy,
                  timestamp,
                  deviceId: anonymized_deviceId,
                  connectionType,
                  speed: speed || '',
                  networks: '',
              },
              {
                  httpsAgent: agent, // Use the custom HTTPS agent
              }
          );
  
          console.log('Location data sent successfully:', response.data);
      } catch (error) {
          console.error('Error sending location:', error.message, error.response?.data || error);
      }
  }
  
  
  
  // Function to process each row
async function processRows(worksheet) {
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const location = row.getCell(1); // Columns are 1-based
        const accuracy = row.getCell(2); 
        const loc=location.value.split(",", 2);
        const lat=parseFloat(loc[0]);
        const lng=parseFloat(loc[1]);
        const times =getRandomInt(1,20);
        console.log(`${rowNumber}: location=${lat}, ${typeof(lat)}, accuracy=${accuracy.value},  wifi= ${getRandomInt(1,2)}, fores=${times}`);
        for (let i=0; i<times; i++){
            const isWifi = Math.random() < 0.5;
            const connectionType = isWifi ? "wifi" : "cellular";
            console.log("posting", lat,lng,accuracy.value,getRandomInt(3,50),connectionType,0);
            
            try {
                await post(lat,lng,accuracy.value,getRandomInt(50,200),connectionType,speed=0 ); // Ensure each post is completed before proceeding
            } catch (error) {
                console.error('Error sending location:', error);
            }
        }
        await sleep(6000); // Wait for 2 minutes before processing the next row
    }
}
  
  // Main function to repeatedly process rows
  async function repeatProcessing(workbookPath, sheetName, intervalMs) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(workbookPath);
    const worksheet = workbook.getWorksheet(sheetName);
  
    while (true) {
      await processRows(worksheet);
      console.log(`Completed a full pass. Waiting for ${intervalMs / 1000} seconds...`);
      await sleep(intervalMs); // Wait for the specified interval before starting the next iteration
    }
  }
  
  // Usage
  const workbookPath = 'C:/Users/eugk/Documents/thesis/App-test/angthesis/src/app/fakerdata.xlsx';
  const sheetName = 'Sheet1';
  const intervalMs = 60000;
  
  repeatProcessing(workbookPath, sheetName, intervalMs);

  
