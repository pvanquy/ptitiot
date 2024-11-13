document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    console.log('Attempting to connect to WebSocket');

    socket.on('connect', () => {
        console.log('WebSocket connected successfully');
    });

    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
    });

    const navButtons = document.querySelectorAll('.nav-button');
    const contentSections = document.querySelectorAll('.content');
    const ledSwitches = document.querySelectorAll('.switch input');
    const warningIndicator = document.getElementById('warningIndicator');
    const warningStatus = document.getElementById('warningStatus');
    const warningDescription = document.getElementById('warningDescription');
    let chart;

    // Navigation
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const navTarget = button.getAttribute('data-nav');
            navButtons.forEach(btn => btn.classList.remove('active'));
            contentSections.forEach(section => section.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`${navTarget}-content`).classList.add('active');

            if (navTarget === 'datasensor') {
                fetchSensorData();
            } else if (navTarget === 'devices') {
                fetchLedHistory();
            }
        });
    });

    // LED Controls
    ledSwitches.forEach(switchEl => {
        switchEl.addEventListener('change', (e) => {
            const led = e.target.id;
            const state = e.target.checked;
            fetch('/api/toggle-led', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ led, state }),
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    console.error('Failed to toggle LED');
                    e.target.checked = !state; // Revert the switch if the action failed
                }
            })
            .catch(error => {
                console.error('Error:', error);
                e.target.checked = !state; // Revert the switch if there was an error
            });
        });
    });

    // Update sensor data
    function updateSensorData(data) {
        console.log('Updating sensor data:', data);
        if (data.temperature !== undefined) {
            document.getElementById('temperature').textContent = `${data.temperature.toFixed(1)}°C`;
        }
        if (data.humidity !== undefined) {
            document.getElementById('humidity').textContent = `${data.humidity.toFixed(0)}%`;
        }
        if (data.light !== undefined) {
            document.getElementById('light').textContent = `${data.light.toFixed(0)} lux`;
        }

        // Update warning light
        const isWarning = data.light > 1000;
        warningIndicator.classList.toggle('active', isWarning);
        warningStatus.textContent = isWarning ? 'Warning: High Light Level' : 'Light Level Normal';
        warningDescription.textContent = isWarning ? 'Light level exceeds 1000 lux' : 'Light level is within normal range';

        // Update chart
        updateChart(data);
    }

    // Update chart
    function updateChart(newData) {
        if (!chart) {
            const ctx = document.getElementById('sensorChart').getContext('2d');
            chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Temperature (°C)',
                        data: [],
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    }, {
                        label: 'Humidity (%)',
                        data: [],
                        borderColor: 'rgb(54, 162, 235)',
                        tension: 0.1
                    }, {
                        label: 'Light (lux)',
                        data: [],
                        borderColor: 'rgb(255, 206, 86)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            reverse: true
                        },
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        const timestamp = new Date(newData.time).toLocaleTimeString();
        chart.data.labels.unshift(timestamp);
        chart.data.datasets[0].data.unshift(newData.temperature);
        chart.data.datasets[1].data.unshift(newData.humidity);
        chart.data.datasets[2].data.unshift(newData.light);

        if (chart.data.labels.length > 100) {
            chart.data.labels.pop();
            chart.data.datasets.forEach(dataset => dataset.data.pop());
        }

        chart.update();
    }

    // Fetch and display sensor data
    function fetchSensorData() {
        fetch('/api/sensor-data')
            .then(response => response.json())
            .then(data => {
                console.log('Fetched sensor data:', data);
                const tableBody = document.getElementById('sensorDataBody');
                tableBody.innerHTML = '';
                data.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${new Date(row.time).toLocaleString()}</td>
                        <td>${row.temperature.toFixed(1)}</td>
                        <td>${row.humidity.toFixed(0)}</td>
                        <td>${row.light.toFixed(0)}</td>
                    `;
                    tableBody.appendChild(tr);
                });
            })
            .catch(error => console.error('Error fetching sensor data:', error));
    }

    // Fetch and display LED history
    function fetchLedHistory() {
        fetch('/api/led-history')
            .then(response => response.json())
            .then(data => {
                console.log('Fetched LED history:', data);
                const tableBody = document.getElementById('ledHistoryBody');
                tableBody.innerHTML = '';
                data.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${new Date(row.time).toLocaleString()}</td>
                        <td>${row.device}</td>
                        <td>${row.action}</td>
                    `;
                    tableBody.appendChild(tr);
                });
            })
            .catch(error => console.error('Error fetching LED history:', error));
    }

    // Socket.IO event listeners
    socket.on('sensorUpdate', (data) => {
        console.log('Received sensor update:', data);
        updateSensorData(data);
        if (document.getElementById('datasensor-content').classList.contains('active')) {
            fetchSensorData();
        }
    });

    socket.on('ledUpdate', (data) => {
        console.log('Received LED update:', data);
        const ledSwitch = document.getElementById(data.device.toLowerCase());
        if (ledSwitch) {
            ledSwitch.checked = data.action === 'on';
        }
        if (document.getElementById('devices-content').classList.contains('active')) {
            fetchLedHistory();
        }
    });

    // Initial data fetch
    fetch('/api/sensor-data')
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                updateSensorData(data[0]);
                data.reverse().forEach(row => updateChart(row));
            }
        })
        .catch(error => console.error('Error fetching initial sensor data:', error));
});