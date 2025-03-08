import os
import asyncio
from flask import Flask, request, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import StaleElementReferenceException, TimeoutException
import threading
import aiohttp
import time
import ssl

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE
print(os.path.exists("model.tflite")) 
# model_path = os.path.join(os.getcwd(), "model.tflite")
# interpreter = tf.lite.Interpreter(model_path=model_path)


app = Flask(__name__)
CORS(app)

received_data = {}


@app.route('/station_data', methods=['POST', 'GET'])
def station_data():
    global received_data
    if request.method == 'POST':
        received_data = request.json
        print('Data received:', received_data)
        return 'Data sent successfully', 200
    elif request.method == 'GET':
        return jsonify(received_data), 200


def run_server():
    app.run(host='0.0.0.0', port=4000, use_reloader=False, ssl_context=('C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.crt', 'C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.key'))



class DriverTask:
    def __init__(self, driver_path, search_query):
        self.search_query = search_query
        self.driver = self._create_driver(driver_path)

    def _create_driver(self, driver_path):
        options = Options()
        # options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-background-timer-throttling")
        service = Service(driver_path)
        
        driver = webdriver.Chrome(service=service, options=options)
        url = 'https://patra.citybus.gr/el/stops'
        driver.get(url)
        for attempt in range(5):  
            try:
                WebDriverWait(driver, 15).until(EC.invisibility_of_element((By.ID, "mainSpinner")))
                map_stop_text = WebDriverWait(driver, 15).until(EC.element_to_be_clickable((By.ID, 'mapStopText')))
                driver.execute_script("arguments[0].scrollIntoView();", map_stop_text)
                map_stop_text.click()

                search = WebDriverWait(driver, 25).until(EC.element_to_be_clickable((By.ID, 'searchStop')))
                search_query = self.search_query[0] + " " + self.search_query[1][:4] + Keys.RETURN
                search.clear() 
                search.send_keys(search_query)
                time.sleep(3) 
                search.send_keys(Keys.RETURN) 
                time.sleep(3) 
                
                element = WebDriverWait(driver, 15).until(EC.element_to_be_clickable((By.CSS_SELECTOR, 'span.code')))
                element.click()
                map_stop_text = WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.ID, 'mapStopText')))
                expected_text = f"{self.search_query[0]}: {self.search_query[1]}"
                if map_stop_text.text.strip() == expected_text:
                    print("Found the expected text in mapStopText!")
                    time.sleep(5) 
                    
                    vehicles_list = WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, 'vehiclesList')))
                    vehicle_items = vehicles_list.find_elements(By.CSS_SELECTOR, 'li.vehicle')
                    try:
                        l =WebDriverWait(driver, 10).until(
                            lambda d: vehicle_items[0].find_element(By.CSS_SELECTOR, 'div.line > div').text.strip()
                        )
                    except TimeoutException:
                        print("Timeout waiting for the element to become clickable.")
                        driver.quit()  
                        driver = self._create_driver(driver_path)  
                        break
                    if (not l):
                        print(driver.page_source)
                    break
                else:
                    print(f"Unexpected text in mapStopText: {map_stop_text.text.strip()}")
                    attempt +=1
                
                
            except StaleElementReferenceException:
                print(f"Attempt {attempt + 1}: Element became stale. Retrying...")
            except TimeoutException:
                print("Timeout waiting for the element to become clickable.")
            except Exception as e:
                print(f"Unexpected error: {e}llll")
                if (str(e) == "list index out of range"):
                    break
                else:
                    driver.quit() 
                    driver = self._create_driver(driver_path) 
                    break
        else:
            raise Exception("Failed to click span.code after multiple attempts.")
        time.sleep(5)  
        
            
        return driver
        

    def fetch_station_data(self):
        try:

            vehicles_list = WebDriverWait(self.driver, 15).until(EC.presence_of_element_located((By.ID, 'vehiclesList')))
            vehicle_items = vehicles_list.find_elements(By.CSS_SELECTOR, 'li.vehicle')
            data = {
                "station": self.search_query[0],
                "vehicles": []
            }
            for vehicle in vehicle_items:
                try:
                    
                    line = WebDriverWait(vehicle, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, 'div.line > div'))
                    ).text.strip()
                    departure = WebDriverWait(vehicle, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, 'div.departure > div'))
                    ).text.strip()
                    route = WebDriverWait(vehicle, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, 'div.route > div'))
                    ).text.strip()
                    vehicle_data = {
                        "line": line,
                        "departure": departure.replace("\n", " "),
                        "route": route
                    }
                    data["vehicles"].append(vehicle_data)
                except Exception as e:
                    print(f'Error occurred: {e}')
            return data
        except Exception as e:
            print(f"Error fetching data for station {self.search_query[0]}: {e}")
            return None
        
    def stop(self):
        self.driver.quit()


async def fetch_data_periodically(driver_task, data_list, lock):
    loop = asyncio.get_running_loop()
    while True:
        try:
            data = await loop.run_in_executor(None, driver_task.fetch_station_data)
            if data:
                async with lock:
                    data_list.append(data)
                    print(f"Fetched data: {data}")
        except Exception as e:
            print(f"Error in periodic fetch: {e}")
        await asyncio.sleep(1)

async def send_data_periodically(data_list, lock):
    async with aiohttp.ClientSession() as session:
        while True:
            await asyncio.sleep(2)  
            async with lock:
                if data_list:
                    data_to_send = data_list.copy()
                    data_list.clear()
                else:
                    continue

            try:
                async with session.post("https://localhost:4000/station_data", ssl=ssl_context, json=data_to_send) as response:
                    if response.status == 200:
                        print("Data sent successfully")
                    else:
                        print(f"Failed to send data. Status: {response.status}")
            except Exception as e:
                print(f"Error sending data: {e}")


async def main(search_queries):
    driver_path = "C:/Users/eugk/Documents/thesis/App-test/angthesis/src/app/chromedriver-win64/chromedriver.exe"
    driver_tasks = [DriverTask(driver_path, query) for query in search_queries]

    data_list = []
    lock = asyncio.Lock()

    try:
        fetch_tasks = [fetch_data_periodically(task, data_list, lock) for task in driver_tasks]

        send_task = send_data_periodically(data_list, lock)

        await asyncio.gather(*fetch_tasks, send_task)
    finally:
        for task in driver_tasks:
            task.stop()



if __name__ == "__main__":
    search_queries = [
        ["678", "ΠΡΥΤΑΝΕΙΑ"],
        ["655", "ΠΟΛΥΤΕΧΝΕΙΟ"],
        ["654", "ΣΥΝΕΔΡΙΑΚΟ ΚΕΝΤΡΟ"],
        ["679", "ΦΥΣΙΚΟ"],
        ["465", "ΓΕΩΛΟΓΙΚΟ"],
        ["537", "ΓΕΩΛΟΓΙΚΟ"],
        ["467", "ΙΑΤΡΙΚΗ"],
        ["536", "ΙΑΤΡΙΚΗ"],
        ["534", "ΤΕΡΜΑ ΝΟΣΟΚΟΜΕΙΟ"],
    ]
    threading.Thread(target=run_server, daemon=True).start()
    asyncio.run(main(search_queries))
