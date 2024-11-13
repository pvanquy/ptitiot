import paho.mqtt.client as mqtt
import mysql.connector
from datetime import datetime

# Kết nối với MySQL
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="2003",
    database="sensordata"
)

cursor = db.cursor()

# Hàm lưu dữ liệu LED vào MySQL
def save_led_status_to_mysql(device, action):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    sql = "INSERT INTO ledlog (device, action, time) VALUES (%s, %s, %s)"
    cursor.execute(sql, (device, action, timestamp))
    db.commit()
    print(f"Saved to MySQL: device={device}, action={action}, time={timestamp}")

# Hàm lưu dữ liệu cảm biến vào MySQL
def save_sensor_data_to_mysql(time_str, temp, humidity, light):
    sql = "INSERT INTO SensorData (time, temperature, humidity, light) VALUES (%s, %s, %s, %s)"
    values = (time_str, temp, humidity, light)
    cursor.execute(sql, values)
    db.commit()
    print("Sensor data inserted into MySQL successfully")

# Hàm được gọi khi có kết nối MQTT thành công
def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe("inn")  # Lắng nghe chủ đề "inn" cho lệnh điều khiển LED
    client.subscribe("outt") # Lắng nghe chủ đề "outt" cho dữ liệu cảm biến

# Hàm xử lý tin nhắn
def on_message(client, userdata, msg):
    print(f"Received message on {msg.topic}: {msg.payload.decode()}")
    message = msg.payload.decode()

    if msg.topic == "inn":
        # Xử lý lệnh điều khiển LED
        if message == "LED1_ON":
            save_led_status_to_mysql("LED1", "bật")
        elif message == "LED1_OFF":
            save_led_status_to_mysql("LED1", "tắt")
        elif message == "LED2_ON":
            save_led_status_to_mysql("LED2", "bật")
        elif message == "LED2_OFF":
            save_led_status_to_mysql("LED2", "tắt")
        elif message == "LED3_ON":
            save_led_status_to_mysql("LED3", "bật")
        elif message == "LED3_OFF":
            save_led_status_to_mysql("LED3", "tắt")
        elif message == "ON_ALL":
            save_led_status_to_mysql("ALL", "bật")
        elif message == "OFF_ALL":
            save_led_status_to_mysql("ALL", "tắt")
        else:
            print("Unknown command received for LED control")

    elif msg.topic == "outt":
        # Xử lý dữ liệu cảm biến
        try:
            parts = message.split(", ")
            time_str = parts[0].split(": ")[1]
            temp = float(parts[1].split(": ")[1].replace(" C", ""))
            humidity = float(parts[2].split(": ")[1].replace("%", ""))
            light = float(parts[3].split(": ")[1].replace(" Lux", ""))

            save_sensor_data_to_mysql(time_str, temp, humidity, light)

        except Exception as e:
            print(f"Error processing sensor data message: {e}")

# Tạo client MQTT và cấu hình callback
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

# Kết nối tới broker MQTT
client.username_pw_set("quy1", "2003")
client.connect("172.20.10.3", 1888, 60)  # Điều chỉnh IP và port nếu cần

# Vòng lặp chờ tin nhắn
client.loop_forever()
