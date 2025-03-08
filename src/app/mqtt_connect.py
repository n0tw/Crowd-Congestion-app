import json
import requests
from paho.mqtt import client as mqtt
from ast import literal_eval
import logging
import mysql.connector
import time
from concurrent.futures import ThreadPoolExecutor

thread_pool = ThreadPoolExecutor(max_workers=3)
processed_messages = set()

mysql_config = {
    'host': '150.140.186.118',
    'database': 'default',  
    'user': 'root',
    'password': 'root_password'  
}

context_broker_url = "http://150.140.186.118:1026/v2/entities"
headers = {
    "Content-Type": "application/json",
    "Fiware-Service": "default",
    "Fiware-ServicePath": "/environmental"
}

subscrtocygnus = {
    "description": "Notify Cygnus of any change in WeatherObserved or NoiseLevelObserved entities",
    "subject": {
        "entities": [
            {
                "idPattern": ".*",
                "type": "NoiseLevelObserved"
            },
            {
                "idPattern": ".*",
                "type": "WeatherObserved"
            },
        ],
        "condition": {
            "attrs": []
        }
    },
    "notification": {
        "http": {
            "url": "http://150.140.186.118:5050/notify"
        },
        "attrs": []
    },
    "throttling": 5
}

def create_subscription():
    try:
        subscription_url = "http://150.140.186.118:1026/v2/subscriptions"
        response = requests.post(subscription_url, headers=headers, data=json.dumps(subscrtocygnus))
        if response.status_code == 201:
            logging.debug("Subscription created successfully")
        else:
            logging.error(f"Failed to create subscription: {response.status_code}, {response.text}")
    except Exception as e:
        logging.error(f"Exception occurred during subscription creation: {e}")

def on_message(client, userdata, message):
    
    try:
        thread_pool.submit(process_message, client, userdata, message)
    except Exception as e:
        print(f"Error processing message: {e}")

def process_message(client, userdata, message):
    logging.debug(f"Message received: {message.payload.decode()}")
    logging.debug("Message offloaded to processing thread")
    payload = message.payload.decode()
    logging.debug(f"Received MQTT message: {payload}")
    

    try:
        data_dict = literal_eval(payload)
        logging.debug(f"Parsed data_dict: {data_dict}")

        if 'object' not in data_dict or 'rxInfo' not in data_dict or len(data_dict['rxInfo']) == 0:
            logging.error(f"Malformed message: missing required keys. Payload: {payload}")
            return

        data = data_dict['object']
        dt = None

        if 'measurements' in data:
            entity_id = "NoiseLevel"
            logging.debug(f"Formatted entity ID: {entity_id}")
            data = data['measurements']
            type = "NoiseLevelObserved"
            dt = {
                "LAS": {"type": "Number", "value": float(data[0]['LAs'])},
                "LAeq": {"type": "Number", "value": float(data[0]['LAeq'])},
                "LAmax": {"type": "Number", "value": float(data[0]['LAmax'])},
                "LCeq": {"type": "Number", "value": float(data[0]['LCeq'])},
                "LCmin": {"type": "Number", "value": float(data[0]['LCmin'])},
                "LCmax": {"type": "Number", "value": float(data[0]['LCmax'])},
                "LAmin": {"type": "Number", "value": float(data[0]['LAmin'])},
                "LCf": {"type": "Number", "value": float(data[0]['LCf'])},
                "LCs": {"type": "Number", "value": float(data[0]['LCs'])},
                "LAf": {"type": "Number", "value": float(data[0]['LAf'])},
                "dateObserved": {"type": "Text", "value": data_dict['time']}
            }

        elif 'Pressure' in data:
            logging.debug(f"Atmospheric data received: {data}")
            entity_id = "Weather:Atmospheric"
            type = "WeatherObserved"
            dt = {
                "rainMinTime": {"type": "Number", "value": float(data['Rain min time'])},
                "atmosphericPressure": {"type": "Number","value": float(data['Pressure'])},
                "directIrradiation": {"type": "Number", "value": float(data['Irradiation'])},
                "dateObserved": {"type": "Text", "value": data_dict['time']},
                "airTemperatureTSA": {"type": "Number", "value": float(data['Temperature'])},
                "precipitation": {"type": "Number", "value": float(data['Rain'])},
                "relativeHumidity": {"type": "Number", "value": float(data['Humidity'])}
            }
        else:
            logging.debug(f"Wind data received: {data}")
            entity_id = "Weather:Wind"
            type = "WeatherObserved"
            dt = {
                "dateObserved": {"type": "Text", "value": data_dict['time']},
                "windDirection": {"type": "Number", "value": float(data['6_Dir_ave10'])},
                "windSpeed": {"type": "Number", "value": float(data['3_Wind_ave10'])}
            }

        logging.debug(f"Payload for context broker: {dt}")

        get_url = f"{context_broker_url}/{entity_id}"
        get_headers = {
            "Accept": "application/json",
            "Fiware-Service": "default",
            "Fiware-ServicePath": "/environmental"
        }

        get_response = requests.get(get_url, headers=get_headers)
        if get_response.status_code == 200:
            logging.debug("Entity exists, updating it")
            update_url = f"{context_broker_url}/{entity_id}/attrs"
            response = requests.patch(update_url, headers=headers, data=json.dumps(dt))
        else:
            logging.debug("Entity does not exist, creating a new one")
            dt["id"] = entity_id  
            dt["type"] = type 
            response = requests.post(context_broker_url, headers=headers, data=json.dumps(dt))

        if response.status_code in [200, 201,204]:
            logging.debug("Data sent to context broker successfully")
            logging.debug(f"Entity ID: {entity_id}")
            # verify_in_mysql(entity_id, dt)
        else:
            logging.error(f"Failed to send data to context broker: {response.status_code}, {response.text}")
        logging.debug(f"Data processed: {data_dict}")
    except Exception as e:
        logging.error(f"Error processing message: {e}")


def verify_in_mysql(entity_id, dt):
    try:
        cnx = mysql.connector.connect(**mysql_config)
        cursor = cnx.cursor(dictionary=True)
        
        cursor.execute("SHOW TABLES;")
        tables = cursor.fetchall()
        
        entity_found = False

        for table in tables:
            table_name = list(table.values())[0]
            cursor.execute(f"SHOW COLUMNS FROM `{table_name}`;")
            columns = cursor.fetchall()

            has_entity_id = any(column['Field'].lower() == 'entityid' for column in columns)
            
            if not has_entity_id:
                logging.debug(f"Skipping table {table_name} as it does not have 'entityId' column")
                continue  
            
            query = f"SELECT * FROM `{table_name}` WHERE `entityId` = %s"
            cursor.execute(query, (entity_id,))

            results = cursor.fetchall()
            if results:
                logging.debug(f"Data found in table {table_name}:")
                entity_found = True
                break
        
        if not entity_found:
            logging.debug("Data not found in any table")

        cursor.close()
        cnx.close()

    except mysql.connector.Error as err:
        logging.error(f"Error connecting to MySQL: {err}")

def reconnect_mqtt(client):
    while True:
        try:
            client.reconnect()
            break
        except Exception as e:
            logging.error(f"Reconnection failed: {e}")
            time.sleep(5)



def connect_mqtt():
    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            logging.debug("Connected to MQTT broker")
        else:
            logging.error(f"Failed to connect, return code {rc}")
            client.reconnect()
    
    try:
        client = mqtt.Client()
        client.on_connect = on_connect
        client.on_message = on_message
        client.connect(broker, port)
        client.subscribe(topic)
        client.loop_start()

        while True:
            time.sleep(1)  
    except Exception as e:
        logging.error(f"Failed to connect to MQTT broker: {e}")
        reconnect_mqtt(client)

    return client

broker = "150.140.186.118" 
port = 1883
topic = "Environmental/#"

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
    
    create_subscription()
    mqtt_client = connect_mqtt()
