@echo off
echo Running Python Script...
start "" python src/app/web_scraping.py

start "" python src/app/ai2.py

echo Running Python Script...
start "" python src/app/takecngestiondata.py

echo Running Node.js Script...
start cmd /k "node src/app/edgecontroller.js"

start cmd /k "node src/app/faker.js"

echo Running Python Script...
start "" python src/app/mqtt_connect.py

echo Running Python Script...
start "" python dist/updater/updater.py

echo 
start "" ng serve --ssl true --ssl-key src/assets/server.key --ssl-cert src/assets/server.crt --host 0.0.0.0


pause

echo Stopping all scripts...
taskkill /IM node.exe /F /T  

taskkill /IM python.exe /F /T  