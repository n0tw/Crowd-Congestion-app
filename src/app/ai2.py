from influxdb_client.client.write_api import SYNCHRONOUS
from influxdb_client import InfluxDBClient
import pandas as pd
from flask import Flask, jsonify, request
from xgboost import XGBRegressor
import joblib
from sklearn.model_selection import train_test_split
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error
from datetime import timedelta
from datetime import datetime, timezone, timedelta
import asyncio
import traceback, sys
import time
import matplotlib.pyplot as plt

app = Flask(__name__)

influxdb_url = "http://iot.patras5g.eu:8086/"
token = "3BH0s3E5frLeMaWJaNNGMmnhguxAWZMw6aue9CiiTphujttzE6laUOgv7KUpQdp5gwWp34jUJCVR6Mi_WpjTpQ=="
org = "nam"
bucket = "estia_data"


async def get_data_by_location(location, start_time=None, end_time=None, time_periods=None, weekday=None):    
    if weekday is not None and not isinstance(weekday, int):
        raise ValueError("weekday must be an integer between 0 (Monday) and 6 (Sunday).")

    with InfluxDBClient(url=influxdb_url, token=token, org=org) as client:
        records = []

        if time_periods:
            for period in time_periods:
                recs = []
                print(period[0], period[1])
                query = f'''
                from(bucket: "{bucket}")
                |> range(start: {period[0] if period[0] else '0'}, stop: {period[1] if period[1] else 'now()'})
                |> filter(fn: (r) => r["_measurement"] == "{location}")
                |> filter(fn: (r) => r["_field"] == "crowd_size")
                |> keep(columns: ["_time", "_value"])
                |> sort(columns: ["_time"], desc: false)
                '''
                try:
                    result = client.query_api().query(query=query, org=org)
                except Exception as e:
                    print(f"Error querying InfluxDB: {e}")
                    return []

                for table in result:
                    for rec in table.records:
                        recs.append({
                            "date": rec.get_time(),
                            "crowd_size": rec.get_value()
                        })

                if recs:
                    df = pd.DataFrame(recs)
                    df['date'] = pd.to_datetime(df['date'])
                    df.set_index('date', inplace=True)
                    start_time = df.index.min().floor('5T')
                else:
                    start_time = pd.Timestamp.now(tz='UTC').floor('5T')

                end_time = start_time + pd.Timedelta(hours=3)
                full_range = pd.date_range(start=start_time, end=end_time, freq='5T', tz='UTC')

                if recs:
                    df_resampled = df.resample('5T').mean().reindex(full_range).fillna(0)
                else:
                    df_resampled = pd.DataFrame(0, index=full_range, columns=['value'])

                df_resampled.reset_index(inplace=True)
                df_resampled.rename(columns={'index': 'date'}, inplace=True)

                recs = df_resampled.to_dict(orient='records')
                records += recs
            return records

        if start_time and end_time:
            if start_time >= end_time:
                print("Error: start_time must be earlier than end_time")
                return []

        query = f'''
        from(bucket: "{bucket}")
        |> range(start: {start_time if start_time else '0'}, stop: {end_time if end_time else 'now()'})
        |> filter(fn: (r) => r["_measurement"] == "{location}")
        |> filter(fn: (r) => r["_field"] == "crowd_size")
        |> keep(columns: ["_time", "_value"])
        |> sort(columns: ["_time"], desc: false)
        '''
        try:
            result = client.query_api().query(query=query, org=org)
        except Exception as e:
            print(f"Error querying InfluxDB: {e}")
            return []

        for table in result:
            for record in table.records:
                records.append({
                    "date": record.get_time(),
                    "crowd_size": record.get_value()
                })

    return records


async def get_spot_data(along_weekdays=False, weekday=None):
    time_periods = []
    local_now = datetime.now(timezone.utc) 
    if along_weekdays:
        for i in range(1, 4): 
            start = (local_now - timedelta(days=7 * i)).isoformat()
            end = (local_now - timedelta(days=7 * i) + timedelta(hours=3)).isoformat()
            time_periods.append([start, end])

        waiting_area_data = await get_data_by_location("Waiting Area", time_periods=time_periods, weekday=weekday)
        restaurant_data = await get_data_by_location("Restaurant", time_periods=time_periods, weekday=weekday)
    else:
        waiting_area_data = await get_data_by_location("Waiting Area")
        restaurant_data = await get_data_by_location("Restaurant")

    return waiting_area_data, restaurant_data

@app.route('/send_predata', methods=['GET'])
def send_predata():
    auth_header = request.headers.get('Authorization')
    print("Authorization Header:", auth_header)

    if not auth_header:
        return jsonify({"error": "Authorization header missing"})

    token = auth_header.split(' ')[1] if ' ' in auth_header else None
    print("Token:", token)

    if not token:
        return jsonify({"error": "Token missing"})
    local_now = datetime.now(timezone.utc)- timedelta(hours=0)
    endtime = (local_now + timedelta(hours=3))

    data, data1 = asyncio.run(get_spot_data( along_weekdays=True))
    if not data or not data1:
        print("Fetched data is empty!")
        return jsonify({"error": "No data fetched"})

    try:
        df = pd.DataFrame(data)
        df1 = pd.DataFrame(data1)

        if 'crowd_size' not in df.columns or 'crowd_size' not in df1.columns:
            return jsonify({"error": "'crowd_size' column missing from data"}), 400

        df['date'] = pd.to_datetime(df['date'])
        df1['date'] = pd.to_datetime(df1['date'])
        df['day_of_week'] = df['date'].dt.dayofweek
        df1['day_of_week'] = df1['date'].dt.dayofweek

        df.set_index('date', inplace=True)
        df1.set_index('date', inplace=True)

        model = joblib.load('xgboost_model_20250119-165810.pkl')
        model1 = joblib.load('xgboost_model1_20250119-165810.pkl')
        waiting_area_data = predict_xgmodel(model, df, local_now, endtime)
        restaurant_data = predict_xgmodel(model1, df1, local_now, endtime)

        return jsonify({'status': 'success', 'data': [waiting_area_data, restaurant_data]})

    except Exception as e:
        print(f"Error in prediction: {e}", file=sys.stderr)
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500

def create_lag_features(df, num_lags=143):
    if 'crowd_size' not in df.columns:
        raise ValueError("Missing 'crowd_size' column in the data")
    lagged_columns = []
    df = df.resample('5T').mean() 
    print("Resampled DataFrame length:", len(df))
    
    df['crowd_size'] = df['crowd_size'].fillna(method='ffill').fillna(method='ffill')

    for lag in range(1, num_lags + 1):
        shifted = df['crowd_size'].shift(lag)
        lagged_columns.append(shifted)
    
    lagged_df = pd.concat(lagged_columns, axis=1, keys=[f'lag_{lag}' for lag in range(1, num_lags + 1)])
    
    return lagged_df


def predict_xgmodel(model, df, start_time, end_time):
    timestamps = pd.date_range(start=start_time, end=end_time, freq="5T")

    new_data = pd.DataFrame({'date': timestamps})
    new_data['day_of_week'] = new_data['date'].dt.dayofweek

    lagged_df = create_lag_features(df)
    lagged_df = lagged_df.tail(144)
    lagged_df = lagged_df.fillna(0)
    new_data = new_data.reset_index(drop=True)
    lagged_data = lagged_df.tail(len(new_data)).reset_index(drop=True)

    new_data = pd.concat([new_data, lagged_data], axis=1)
    X_new = new_data[['lag_' + str(i) for i in range(1, 144)] + ['day_of_week']]

    predictions = model.predict(X_new)
    predictions = [round(value) for value in predictions]
    prediction_results = pd.DataFrame({
        'date': new_data['date'],
        'crowd_size': predictions
    })

    print(prediction_results)
    p=prediction_results.to_dict(orient='records')
    return p



def initial_training():
    data, data1 = asyncio.run(get_spot_data())
    print("data[0]",data[0])
    df = pd.DataFrame(data)
    df1 = pd.DataFrame(data1)

    df['date'] = pd.to_datetime(df['date'])
    df1['date'] = pd.to_datetime(df1['date'])
    df['day_of_week'] = df['date'].dt.dayofweek
    df1['day_of_week'] = df1['date'].dt.dayofweek
    df.set_index('date', inplace=True)
    df1.set_index('date', inplace=True)

    df = df.resample('5T').mean()
    df1 = df1.resample('5T').mean()

    lagged_df = create_lag_features(df)
    lagged_df1 = create_lag_features(df1)

    df = pd.concat([df, lagged_df], axis=1)
    df1 = pd.concat([df1, lagged_df1], axis=1)

    df.dropna(inplace=True)
    df.reset_index(drop=True, inplace=True)
    df1.dropna(inplace=True)
    df1.reset_index(drop=True, inplace=True)
    print("df\n", df)
    
    X = df[['lag_' + str(i) for i in range(1, 144)] + ['day_of_week']]  
    y = df['crowd_size']  
    
    X1 = df1[['lag_' + str(i) for i in range(1, 144)] + ['day_of_week']]  
    y1 = df1['crowd_size'] 
    
    model = XGBRegressor(
        n_estimators=600, 
        learning_rate=0.009, 
        random_state=42, 
        max_depth=5, 
        eval_metric="rmse",
        reg_alpha=0.2,  
        reg_lambda=1.0  
    )
    model1 = XGBRegressor(n_estimators=600, learning_rate=0.007, random_state=42, max_depth=5,eval_metric="rmse" )
    tscv = TimeSeriesSplit(n_splits=5)
    mae_list = []
    train_losses = []
    test_losses = []
    for train_index_X, test_index_X in tscv.split(X):
        
        X_train, X_test = X.iloc[train_index_X], X.iloc[test_index_X]
        y_train, y_test = y.iloc[train_index_X], y.iloc[test_index_X]

        eval_set = [(X_train, y_train), (X_test, y_test)]
        
        model.set_params(eval_metric="rmse")
        model.fit(X_train, y_train, eval_set=eval_set,  verbose=False)


        predictions = model.predict(X_test)

        plt.figure()
        plt.scatter(y_test, predictions)
        plt.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], '--', color='k')
        plt.xlabel('True Values')
        plt.ylabel('Predictions')
        plt.legend()
        plt.grid(True)
        plt.title('Model 1: True vs Predicted Values')
        plt.show()

        mae = mean_absolute_error(y_test, predictions)
        print("MAE for df:", mae)
        
        mae_list.append(mae)
        eval_results = model.evals_result()
        train_losses.append(eval_results['validation_0']['rmse'])
        test_losses.append(eval_results['validation_1']['rmse'])
    plt.figure()
    for i in range(len(train_losses)):
        plt.plot(train_losses[i], label=f'Training Fold {i+1}', linestyle='--')
        plt.plot(test_losses[i], label=f'Validation Fold {i+1}', linestyle='-')
    plt.plot(train_losses[-1], label=f'Training', linestyle='--')
    plt.plot(test_losses[-1], label=f'Validation', linestyle='-')

    plt.xlabel('Iterations')
    plt.ylabel('RMSE Loss')
    plt.legend()
    plt.grid(True)
    plt.title('Model 1: Training vs Validation Loss')
    plt.show()
    mae1_list = []
    train_losses1 = []
    test_losses1 = []
    
    tscv_X1 = TimeSeriesSplit(n_splits=5)
    for train_index_X1, test_index_X1 in tscv_X1.split(X1):
        
        X1_train, X1_test = X1.iloc[train_index_X1], X1.iloc[test_index_X1]
        y1_train, y1_test = y1.iloc[train_index_X1], y1.iloc[test_index_X1]

        eval_set1 = [(X1_train, y1_train), (X1_test, y1_test)]
        model1.set_params(eval_metric="rmse")
        
        model1.fit(X1_train, y1_train, 
                eval_set=eval_set1,  
                verbose=False)

        predictions1 = model1.predict(X1_test)

        plt.figure()
        plt.scatter(y1_test, predictions1)
        plt.plot([y1_test.min(), y1_test.max()], [y1_test.min(), y1_test.max()], '--', color='k')
        plt.xlabel('True Values')
        plt.ylabel('Predictions')
        plt.legend()
        plt.grid(True)
        plt.title('Model 2: True vs Predicted Values')
        plt.show()
        mae1 = mean_absolute_error(y1_test, predictions1)
        print("MAE for df1:", mae1)
        
        mae1_list.append(mae1)
        eval_results1 = model1.evals_result()
        train_losses1.append(eval_results1['validation_0']['rmse'])
        test_losses1.append(eval_results1['validation_1']['rmse'])

    plt.figure()
    """ for i in range(len(train_losses1)):
        plt.plot(train_losses1[i], label=f'Training Fold {i+1}', linestyle='--')
        plt.plot(test_losses1[i], label=f'Validation Fold {i+1}', linestyle='-') """

    plt.plot(train_losses1[-1], label=f'Training', linestyle='--')
    plt.plot(test_losses1[-1], label=f'Validation', linestyle='-')
    plt.xlabel('Iterations')
    plt.ylabel('RMSE Loss')
    plt.legend()
    plt.grid(True)
    plt.title('Model 2: Training vs Validation Loss')
    plt.show()
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    # joblib.dump(model, f'RandomForestRegressor_model_20250119-165810.pkl')
    # joblib.dump(model1, f'RandomForestRegressor_model1_20250119-165810.pkl')
    
    return model, model1, df, df1


# model, model1, df, df1 = initial_training()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=3000, ssl_context=('C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.crt', 'C:/Users/eugk/Documents/thesis/App-test/angthesis/src/assets/server.key'))
