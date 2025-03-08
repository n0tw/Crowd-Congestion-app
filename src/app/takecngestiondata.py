import influxdb_client
from influxdb_client.client.write_api import SYNCHRONOUS
from mysql.connector import Error
from dotenv import load_dotenv
from datetime import timedelta
from datetime import datetime, timezone, timedelta
from flask import Flask, jsonify,request
from flask_cors import CORS
import httpx
import requests
from werkzeug.serving import WSGIRequestHandler
import urllib3
import pytz
WSGIRequestHandler.protocol_version = "HTTP/1.1"
cert_path = "C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.crt"
local_timezone = pytz.timezone("Europe/Athens")
influxdb_url = "http://iot.patras5g.eu:8086/"
token = "3BH0s3E5frLeMaWJaNNGMmnhguxAWZMw6aue9CiiTphujttzE6laUOgv7KUpQdp5gwWp34jUJCVR6Mi_WpjTpQ=="
org = "nam"
bucket = "estia_data"
client = influxdb_client.InfluxDBClient(url=influxdb_url, token=token, org=org)
write_api = client.write_api(write_options=SYNCHRONOUS)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["https://127.0.0.1:2200", "https://127.0.0.1:5000"]}})

load_dotenv()

def get_data_by_location(location=None, start_time=None, end_time=None):
    if start_time and end_time:
        if start_time >= end_time:
            print("Error: start_time must be earlier than end_time")
            return []

    if location!=None:
        query = f'''
        from(bucket: "{bucket}")
        |> range(start: {start_time if start_time else '0'}, stop: {end_time if end_time else 'now()'})
        |> filter(fn: (r) => r["_measurement"] == "{location}")
        |> filter(fn: (r) => r["_field"] == "crowd_size")
        |> keep(columns: ["_time", "_value"])
        |> sort(columns: ["_time"], desc: false)
        '''
    else:
        query = f'''
        from(bucket: "{bucket}")
        |> range(start: {start_time if start_time else '0'}, stop: {end_time if end_time else 'now()'})
        |> filter(fn: (r) => r["_field"] == "crowd_size")
        |> keep(columns: ["_value", "_measurement"])
        |> last()
        '''

    try:
        result = client.query_api().query(query=query, org=org)
    except Exception as e:
        print(f"Error querying InfluxDB: {e}")
        return []

    records = []
    for table in result:
        for record in table.records:
            record_data = {
                "crowd_size": record.get_value(),
            }
            if not location:
                record_data["location"] = record.get_measurement()
            else:
                record_data["time"]= record.get_time()
                # record_data["time"]= record.get_time()+ timedelta(days=7)
            records.append(record_data)
    print(records)

    return records



def processdata(line, restaurant, a, rest_appdata =None,line_appdata = None):
    stm = line[0]['time']
    rs_line=[]
    rs_restaurant=[]
    etm =stm + timedelta(minutes=a)
    
    while etm <=line[-1]['time']+ timedelta(minutes=a):
        filtered_line = [element for element in line if stm <= element['time'] <= etm]
        filtered_restaurant = [element for element in restaurant if stm <= element['time'] <= etm]
        if not filtered_line:
            filtered_line=[{'time': stm, 'crowd_size': 0}]
        elif not filtered_restaurant:
            filtered_restaurant=[{'time': stm, 'crowd_size': 0}]
        adding_value = [0,0]
        appdata=[rest_appdata, line_appdata]
        for i in range(len(appdata)):

            if appdata[i] and len(appdata[i]) > 0:
                filtered_appdata = [element for element in appdata[i] if stm <= datetime.fromisoformat(element["datetime"].replace("Z", "")).astimezone() <= etm]
                v = sum(item['value'] for item in filtered_appdata)  
                if len(filtered_appdata) > 0:
                    adding_value[i]= round(v / len(filtered_appdata))
                    
        if filtered_line:
            rs_line.append({'x': stm.astimezone(local_timezone).isoformat(), 'y': filtered_line[0]['crowd_size']+ adding_value[1]})

        if filtered_restaurant:
            rs_restaurant.append({'x': stm.astimezone(local_timezone).isoformat(), 'y': filtered_restaurant[0]['crowd_size']+adding_value[0]})

        stm = etm
        etm += timedelta(minutes=a)
    return rs_line, rs_restaurant


async def app_users(location, headers):
    try:
        async with httpx.AsyncClient(verify=False) as client:
            duration = 5*60 * 60 * 1000
            url = f"https://localhost:5000/waiting_at_location?lat={location[0]}&lng={location[1]}&duration={duration}"
            
            async with httpx.AsyncClient(verify=False) as client:
                response = await client.get(url, headers=headers)
            if response.status_code != 200:
                raise Exception(f"HTTP error! status: {response.status_code}")
            
            data = response.json()
            return data
    except Exception as e:
        print("Error in app_users:", str(e))
        raise


urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
def trigger_prediction(headers):
    response = requests.get("https://localhost:3000/send_predata", headers=headers,verify=False)
    if response.status_code == 200:
        try:
            data = response.json()
            print("Response JSON:", type(data))
            if isinstance(data, dict):
                waiting_area_data = data.get('data', [])[0]
                restaurant_data = data.get('data', [])[1]
                
                print("Waiting Area Data:", waiting_area_data[0])
                print("Restaurant Data:", restaurant_data[0])
                
                return {'waiting_area_data': waiting_area_data, 'restaurant_data': restaurant_data}

            else:
                print("Response is not a dictionary or expected format.")

        except ValueError as e:
            print("Error parsing JSON:", e)
            return jsonify({'status': 'error', 'message': 'Failed to parse JSON'}), 500

    else:
        try:
            error_message = response.json().get('message', 'Unknown error')
        except ValueError:
            error_message = response.text
        return jsonify({'status': 'error', 'message': error_message}), response.status_code


@app.route('/spot-data', methods=['GET'])
async def get_spot_data():
    try:
        auth_header = request.headers.get('Authorization')
        headers = {
            'Authorization': auth_header,
            'Content-Type': 'application/json',
        }
        print("Authorization Header:", auth_header)

        if not auth_header:
            return jsonify({"error": "Authorization header missing"})

        token = auth_header.split(' ')[1] if ' ' in auth_header else None
        print("Token:", token)

        if not token:
            return jsonify({"error": "Token missing"})
        
        result = {
            "line": [],
            "restaurant": []
        }
        

        local_now = (datetime.now(timezone.utc)- timedelta(hours=0)).astimezone(local_timezone)
        
        start_time = (local_now - timedelta(hours=5)).isoformat()
        end_time = local_now.isoformat()
        # start_time = (local_now - timedelta(hours=24+36+5)).isoformat()
        # end_time = (local_now - timedelta(hours=24+36)).isoformat()
        
        waiting_area_data = get_data_by_location(location="Waiting Area", start_time=start_time, end_time=end_time)
        restaurant_data = get_data_by_location(location="Restaurant", start_time=start_time, end_time=end_time)
        
        try:
            rest_loc = [38.28590086740034, 21.78940532544933]
            line_loc = [38.28603963480802, 21.78996141021614]

            rest_appdata= await app_users(rest_loc, headers) 
            line_appdata= await app_users(line_loc, headers)

            print("Rest User data:", rest_appdata)
            print("Line User data:", line_appdata)
        except Exception as e:
            print('Error:', str(e))
            
    
        # waiting_area_data, restaurant_data = processdata(waiting_area_data, restaurant_data,3 )
        waiting_area_data, restaurant_data = processdata(waiting_area_data, restaurant_data,3, rest_appdata,line_appdata )

        result["line"].append(waiting_area_data)
        result["restaurant"].append(restaurant_data)
        predictions =trigger_prediction(headers)

        records =[]
        # d_waiting = proj_waiting_area_data[0]['crowd_size'] - waiting_area_data[-1]['crowd_size']
        # for record in proj_waiting_area_data:
        
        naive_date = datetime.strptime(predictions['waiting_area_data'][0]['date'].replace(' GMT', ''), '%a, %d %b %Y %H:%M:%S')

        gmt = pytz.timezone('GMT')
        gmt_date = gmt.localize(naive_date)

        local_date = gmt_date.astimezone(local_timezone)
        
        for record in predictions['waiting_area_data']:
            if 'date' in record and 'crowd_size' in record:
                # projected_time = (record['time'] + timedelta(days=7)).astimezone(local_timezone).isoformat()
                # crowd_size = max(record['crowd_size'] - d_waiting, 0)
                naive_date = datetime.strptime(record['date'].replace(' GMT', ''), '%a, %d %b %Y %H:%M:%S')
                gmt = pytz.timezone('GMT')
                gmt_date = gmt.localize(naive_date)
                local_date = gmt_date.astimezone(local_timezone)
                records.append({'x':local_date,'y':record['crowd_size']})
        records[0]['y']=result["line"][-1][-1]['y']
        result["line"].append(records)
        records =[]
        # d_restaurant = proj_restaurant_data[0]['crowd_size'] - restaurant_data[-1]['crowd_size']
        # for record in proj_restaurant_data:
        for record in predictions['restaurant_data']:
            if 'date' in record and 'crowd_size' in record:
                # projected_time = (record['time'] + timedelta(days=7)).astimezone(local_timezone).isoformat()
                # crowd_size = max(record['crowd_size'] - d_restaurant, 0)
                naive_date = datetime.strptime(record['date'].replace(' GMT', ''), '%a, %d %b %Y %H:%M:%S')
                gmt = pytz.timezone('GMT')
                gmt_date = gmt.localize(naive_date)
                local_date = gmt_date.astimezone(local_timezone)
                records.append({'x':local_date,'y':record['crowd_size']})
        records[0]['y']=result["restaurant"][-1][-1]['y']
        result["restaurant"].append(records)
        return jsonify(result)

    except Exception as e:
        print('get_spot_data Error:', str(e))
        return jsonify({"error": str(e)}), 500
    


@app.route('/all-data', methods=['GET'])
async def all_data():
    try:
        local_now = datetime.now(timezone.utc).astimezone(local_timezone)
        
        start_time = (local_now - timedelta(minutes=5)).isoformat()
        end_time = local_now.isoformat()
        
        data = get_data_by_location(start_time=start_time, end_time=end_time)

        return jsonify(data)

    except Exception as e:
        print('get_spot_data Error:', str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=2200, ssl_context=('C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.crt', 'C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.key'))



