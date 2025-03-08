from flask import Flask, request, jsonify
from pymongo import MongoClient
from flask_cors import CORS
from datetime import datetime, timezone

app = Flask(__name__)
CORS(app) 

client = MongoClient('mongodb://localhost:27017/') 

db = client['mongooo']  

if 'locs' not in db.list_collection_names():
    db.create_collection('locs')

if 'location_history' not in db.list_collection_names():
    db.create_collection('location_history')

locs_collection = db['locs']
history_collection = db['location_history']

@app.route('/sendlocation')
def sendlocation():
    try:
        lat = float(request.args.get('lat'))
        lng = float(request.args.get('lng'))
        timestamp = str(request.args.get('timestamp'))
        deviceId = str(request.args.get('deviceId'))
        
        response = anonym_client_data(lat, lng, timestamp, deviceId)
        
        return jsonify({"success": True, "response": response})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

def anonym_client_data(lat, lng, timestamp, deviceId):
    entity_id = deviceId + timestamp
    

    # Convert timestamp to seconds
    timestamp_seconds = int(timestamp) / 1000 if timestamp else datetime.now(timezone.utc).timestamp()

    # Create a datetime object from the timestamp
    date_time = datetime.fromtimestamp(timestamp_seconds, timezone.utc)

    # Format the datetime object as a string
    formatted_date_time = [
        date_time.year,
        date_time.month,
        date_time.day,
        date_time.hour,
        date_time.minute,
        date_time.second
    ]
    # formatted_date_time = date_time.strftime("%Y-%m-%d %H:%M:%S")

 
    print("Formatted Date and Time:", formatted_date_time)

    create_entity(entity_id, deviceId, lat, lng, formatted_date_time)  # Always create entity for history
    # Save real-time location in locs collection
    if check_entity_exists(deviceId):
        update_entity(entity_id, deviceId, lat, lng, formatted_date_time)
        print("entity_exists")

    return {"message": "Location data recorded successfully"}


def check_entity_exists(deviceId):
    count = locs_collection.count_documents({'anonymizedId': deviceId})
    return count > 0

def update_entity(entity_id, device_id, lat, lng, timestamp):
    locs_collection.update_one({'_id': entity_id}, {'$set': {'location': {'type': 'Point', 'coordinates': [lat, lng]}, "dateModified": {"type": "DateTime", "value": timestamp}}})

    history_entry = {
        "_id": entity_id,
        "anonymizedId": {
            "type": "Text",
            "value": device_id
        },
        "type": "AnonymousCommuterId",
        "location": {
            "type": "Point",
            "coordinates": [lat, lng]
        },
        "dateCreated": {
            "type": "DateTime",
            "value": timestamp
        },
    }
    history_collection.insert_one(history_entry)

    return {"message": f"Entity {entity_id} updated with new location ({lat}, {lng})"}

def create_entity(entity_id, deviceId,lat, lng, timestamp):
    print("create entity")
    acData = {
        "_id": entity_id,
        "anonymizedId": {
            "type": "Text",
            "value": deviceId
        },
        "type": "AnonymousCommuterId",
        "orig": {
            "type": "Text",
            "value": "City hall"
        },
        "dest": {
            "type": "Text",
            "value": "Library"
        },
        "location": {
            "type": "Point",
            "coordinates": [lat, lng]
        },
        "dateCreated": {
            "type": "DateTime",
            "value": timestamp
        },
        "dateModified": {
            "type": "DateTime",
            "value": timestamp
        }
    }

    history_entry = {
        "_id": entity_id,
        "anonymizedId": {
            "type": "Text",
            "value": deviceId
        },
        "type": "AnonymousCommuterId",
        "location": {
            "type": "Point",
            "coordinates": [lat, lng]
        },
        "dateCreated": {
            "type": "DateTime",
            "value": timestamp
        },
    }

    locs_collection.insert_one(acData)
    history_collection.insert_one(history_entry)
    return {"message": f"New entity created with ID {entity_id} and location ({lat}, {lng})"}

if __name__ == '__main__':
    app.run(debug=True, port=5000)
