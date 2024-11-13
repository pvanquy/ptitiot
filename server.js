const express = require('express');
const mysql = require('mysql2/promise');
const mqtt = require('mqtt');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

// MySQL connection configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '2003',
  database: 'sensordata'
};

// Create MySQL connection pool
const pool = mysql.createPool(dbConfig);

// MQTT client configuration
const mqttClient = mqtt.connect('mqtt://172.20.10.3:1888', {
  username: 'quy1',
  password: '2003'
});

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe('inn');
  mqttClient.subscribe('outt');
});

mqttClient.on('message', async (topic, message) => {
  console.log(`Received message on ${topic}: ${message.toString()}`);
  const messageStr = message.toString();

  if (topic === 'inn') {
    // Handle LED control messages
    if (messageStr.includes('LED')) {
      const [device, action] = messageStr.split('_');
      await saveLedStatus(device, action.toLowerCase());
      io.emit('ledUpdate', { device, action: action.toLowerCase() });
    }
  } else if (topic === 'outt') {
    // Handle sensor data messages
    try {
      const parts = messageStr.split(', ');
      const time = parts[0].split(': ')[1];
      const temperature = parseFloat(parts[1].split(': ')[1].replace(' C', ''));
      const humidity = parseFloat(parts[2].split(': ')[1].replace('%', ''));
      const light = parseFloat(parts[3].split(': ')[1].replace(' Lux', ''));

      await saveSensorData(time, temperature, humidity, light);
      io.emit('sensorUpdate', { time, temperature, humidity, light });
    } catch (error) {
      console.error('Error processing sensor data message:', error);
    }
  }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.json());

// API endpoint to get sensor data
app.get('/api/sensor-data', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM SensorData ORDER BY time DESC LIMIT 100');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get LED history
app.get('/api/led-history', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ledlog ORDER BY time DESC LIMIT 100');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching LED history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to toggle LED
app.post('/api/toggle-led', (req, res) => {
  const { led, state } = req.body;
  const message = state ? `${led.toUpperCase()}_ON` : `${led.toUpperCase()}_OFF`;
  mqttClient.publish('inn', message, (err) => {
    if (err) {
      console.error('Error publishing MQTT message:', err);
      res.status(500).json({ error: 'Failed to toggle LED' });
    } else {
      res.json({ success: true });
    }
  });
});

async function saveSensorData(time, temperature, humidity, light) {
  try {
    await pool.query(
      'INSERT INTO SensorData (time, temperature, humidity, light) VALUES (?, ?, ?, ?)',
      [time, temperature, humidity, light]
    );
    console.log('Sensor data saved successfully');
  } catch (error) {
    console.error('Error saving sensor data:', error);
  }
}

async function saveLedStatus(device, action) {
  try {
    await pool.query(
      'INSERT INTO ledlog (device, action, time) VALUES (?, ?, NOW())',
      [device, action]
    );
    console.log('LED status saved successfully');
  } catch (error) {
    console.error('Error saving LED status:', error);
  }
}

// Socket.IO connection handler
io.on('connection', async (socket) => {
  console.log('A user connected');

  try {
    // Send initial sensor data
    const [sensorRows] = await pool.query('SELECT * FROM SensorData ORDER BY time DESC LIMIT 1');
    if (sensorRows.length > 0) {
      socket.emit('sensorUpdate', sensorRows[0]);
    }

    // Send initial LED status
    const [ledRows] = await pool.query('SELECT * FROM ledlog ORDER BY time DESC LIMIT 3');
    ledRows.forEach(row => {
      socket.emit('ledUpdate', { device: row.device, action: row.action });
    });
  } catch (error) {
    console.error('Error sending initial data:', error);
  }

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});