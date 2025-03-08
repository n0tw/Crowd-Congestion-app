import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta
import json
from collections import defaultdict
import matplotlib.pyplot as plt
import numpy as np

# Load environment variables from .env file
load_dotenv()

def plot_spots(data_dict, datetimes):
    current_spots = defaultdict(list)
    fig, ax = plt.subplots(figsize=(10, 5))
    for idx in range(len(datetimes)):
        total = 0
        total1 = 0
        
        if 'R0_EST-AP_0.3' in data_dict:
            total += data_dict['R0_EST-AP_0.3'][idx]
        if 'R0_EST-AP_0.4' in data_dict:
            total += data_dict['R0_EST-AP_0.4'][idx]
        if 'R0_EST-AP_0.1' in data_dict:
            total += data_dict['R0_EST-AP_0.1'][idx]
        
        
        current_spots["line"].append(total)
        
        if 'R0_EST-AP_0.2' in data_dict:
            total1 += data_dict['R0_EST-AP_0.2'][idx]
    
    
        current_spots["restaurant"].append(total1)
        
    # Plot the summed line
    ax.plot(datetimes, current_spots["line"], label="Line")
    
    
    # Plot the summed line
    ax.plot(datetimes, current_spots["restaurant"], label="restaurant")
    

    ax.set_title(f'Spot Crowds from {1} to {len(data_dict)}')
    ax.set_xlabel('Datetime')
    ax.set_ylabel('Crowd Size')
    ax.legend()
    plt.xticks(rotation=45)
    plt.tight_layout()

    plt.show()

class Measurement:
    def __init__(self, datetime, json_data):
        self.datetime = datetime
        try:
            self.json_data = json.loads(json_data)
        except json.JSONDecodeError:
            self.json_data = None
            print(f"Failed to decode JSON: {json_data}")

    def __repr__(self):
        return f"Measurement(datetime={self.datetime}, json_data={str(self.json_data)})"
    
def perform_analysis(measurement):
    
    ap_dict = defaultdict(int)
    
    if "4" in measurement.json_data:
        
        for entry in measurement.json_data['4']["value"]:
            if "empty_cell" in str(entry) or entry not in ['R0_EST-AP_0.3', 'R0_EST-AP_0.4', 'R0_EST-AP_0.2', 'R0_EST-AP_0.1', 'R0_AMF-AP_0.3']:
                continue
            print("measurement",entry)
            ap_dict[str(entry)]+=1

    #print(ap_dict)
    return ap_dict


try:
    # Fetch database connection details from environment variables
    db_host = os.getenv('DB_HOST')
    db_port = os.getenv('DB_PORT')
    db_user = os.getenv('DB_USER')
    db_password = os.getenv('DB_PASSWORD')
    db_name = os.getenv('DB_NAME')

    # Establish a connection to the MySQL database
    connection = mysql.connector.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_password,
        database=db_name
    )

    if connection.is_connected():
        print("Successfully connected to the database")
        cursor = connection.cursor()

        # First, find the most recent entry's timestamp
        cursor.execute("SELECT MAX(recvTimeTs) FROM WLC_LESXI_WLCdata")
        last_entry_timestamp = float(cursor.fetchone()[0])
        last_entry_datetime = datetime.fromtimestamp(last_entry_timestamp / 1000.0)  # Assuming timestamp is in milliseconds

        # Calculate 6 hours before the last entry
        start_time = last_entry_datetime - timedelta(hours=5)

        # Query to fetch all entries from the last 5 hours from the most recent entry
        cursor.execute("""
            SELECT attrName, attrValue, recvTimeTs
            FROM WLC_LESXI_WLCdata 
            WHERE recvTimeTs BETWEEN %s AND %s 
            ORDER BY recvTimeTs DESC
        """, (
            int(start_time.timestamp() * 1000),  # Start of the 6-hour window
            int(last_entry_datetime.timestamp() * 1000)  # Timestamp of the last entry
        ))

        results = cursor.fetchall()
        measurements = []
        paired_entries = {}

        # Group entries by recvTimeTs
        for name, value, recv_time_ts in results:
            if recv_time_ts not in paired_entries:
                paired_entries[recv_time_ts] = {}
            if name == 'DateTime':
                paired_entries[recv_time_ts]['datetime'] = datetime.strptime(value, '%Y-%m-%dT%H:%M:%S.%fZ')
            elif name == 'csvData':
                paired_entries[recv_time_ts]['json_data'] = value

        # Create Measurement objects from paired entries
        for entry in paired_entries.values():
            if 'datetime' in entry and 'json_data' in entry:
                measurements.append(Measurement(entry['datetime'], entry['json_data']))
            else:
                print("Problem, missing corresponding attributes")

        print(f"Total combined entries: {len(measurements)}")

        aps_snapshots=[]
        aps_datetimes=[]
        aps_names=set()

        for measurement in measurements:
            for key in perform_analysis(measurement):
                if key in ['R0_EST-AP_0.3', 'R0_EST-AP_0.4', 'R0_EST-AP_0.2', 'R0_EST-AP_0.1', 'R0_AMF-AP_0.3']:
                    aps_names.add(key)
        print("keys", aps_names)
        for measurement in measurements:
            result=perform_analysis(measurement)
            for key in aps_names:
                if key not in result:
                    result[key] = -1
                else:
                    #print(key)
                    aps_snapshots.append(result)
                    aps_datetimes.append(measurement.datetime)
        
        aps_history = defaultdict(list)
        for status in aps_snapshots:
            #print(len(status))
            for ap in status:
                aps_history[ap].append(status[ap])

        #print("aps_history[key]",aps_history)
        plot_spots(aps_history,aps_datetimes)

        
            


except Error as e:
    print(f"Error: {e}")

finally:
    if connection and connection.is_connected():
        cursor.close()
        connection.close()
        print("MySQL connection is closed")
