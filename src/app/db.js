const mysql = require('mysql2');

const pool = mysql.createPool({
    'host': '150.140.186.118',
    'database': 'default', 
    'user': 'readonly_student',
    'password': 'iot_password',
    'waitForConnections': 'true',
    'connectionLimit': '10',
    'queueLimit': '0',
    'connectTimeout': '10000'
});

module.exports = pool;