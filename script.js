document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const locationBtn = document.getElementById('location-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const weatherDisplay = document.getElementById('weather-display');
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const celsiusBtn = document.getElementById('celsius-btn');
    const fahrenheitBtn = document.getElementById('fahrenheit-btn');
    const suggestionsContainer = document.getElementById('suggestions');
    const locationEl = document.getElementById('location').querySelector('span');
    const dateTimeEl = document.getElementById('date-time');
    const weatherIcon = document.getElementById('weather-icon');
    const temperatureEl = document.getElementById('temperature').querySelector('.temp-value');
    const weatherDesc = document.getElementById('weather-description');
    const feelsLikeEl = document.getElementById('feels-like');
    const humidityEl = document.getElementById('humidity');
    const windSpeedEl = document.getElementById('wind-speed');
    const uvIndexEl = document.getElementById('uv-index');
    const forecastItems = document.getElementById('forecast-items');
    const lastUpdatedEl = document.getElementById('last-updated');
    const temperatureChartCanvas = document.getElementById('temperature-chart');
    
    // Chart toggle buttons
    const chartControls = document.createElement('div');
    chartControls.className = 'chart-controls';
    chartControls.innerHTML = `
        <button id="toggle-temp" class="chart-toggle active">Temperature</button>
        <button id="toggle-feels-like" class="chart-toggle active">Feels Like</button>
        <button id="toggle-humidity" class="chart-toggle">Humidity</button>
    `;
    
    // Append chart controls before canvas
    if (temperatureChartCanvas) {
        temperatureChartCanvas.parentNode.insertBefore(chartControls, temperatureChartCanvas);
        console.log('Canvas dimensions:', {
            width: temperatureChartCanvas.offsetWidth,
            height: temperatureChartCanvas.offsetHeight,
            parentWidth: temperatureChartCanvas.parentNode.offsetWidth,
            parentHeight: temperatureChartCanvas.parentNode.offsetHeight
        });
    } else {
        console.error('No temperature-chart canvas found in index.html.');
    }
    
    // App state
    let currentUnit = 'celsius';
    let lastSearchedCity = '';
    let currentWeatherData = null;
    let refreshInterval;
    let timeUpdateInterval;
    let temperatureChart = null;
    let showTemp = true;
    let showFeelsLike = true;
    let showHumidity = false;
    
    // Theme toggle setup
    const appActions = document.querySelector('.app-actions') || document.createElement('div');
    appActions.className = 'app-actions';
    const themeToggleBtn = document.createElement('button');
    themeToggleBtn.className = 'theme-toggle-btn btn';
    themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    appActions.appendChild(themeToggleBtn);
    if (!document.querySelector('.app-actions')) {
        document.querySelector('.search-container').appendChild(appActions);
    }
    
    // API Key
    const apiKey = '3cc16fc6d179860bcdb548eb30f7822f';
    
    // Initialize app
    initApp();
    
    // Event listeners
    searchBtn.addEventListener('click', searchWeather);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchWeather();
    });
    searchInput.addEventListener('input', debounce(handleInput, 300));
    locationBtn.addEventListener('click', getLocationWeather);
    refreshBtn.addEventListener('click', refreshWeather);
    celsiusBtn.addEventListener('click', function() {
        if (currentUnit !== 'celsius') {
            toggleUnits('celsius');
        }
    });
    fahrenheitBtn.addEventListener('click', function() {
        if (currentUnit !== 'fahrenheit') {
            toggleUnits('fahrenheit');
        }
    });
    themeToggleBtn.addEventListener('click', toggleTheme);
    document.getElementById('toggle-temp').addEventListener('click', () => toggleChartData('temp'));
    document.getElementById('toggle-feels-like').addEventListener('click', () => toggleChartData('feelsLike'));
    document.getElementById('toggle-humidity').addEventListener('click', () => toggleChartData('humidity'));

    // Debounce function
    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Handle city suggestions
    async function handleInput() {
        const query = searchInput.value.trim();
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'none';

        if (query.length < 2) return;

        try {
            const suggestions = await fetchCitySuggestions(query);
            if (suggestions.length > 0) {
                displaySuggestions(suggestions);
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error.message);
            showError('Failed to fetch city suggestions. Please try again.');
        }
    }

    // Fetch city suggestions
    async function fetchCitySuggestions(query) {
        const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${apiKey}`;
        console.log('Fetching suggestions:', url);
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorBody = await response.text();
                console.error('Suggestions error response:', { status: response.status, body: errorBody });
                if (response.status === 401) throw new Error('Invalid API key.');
                if (response.status === 429) throw new Error('API rate limit exceeded.');
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            return data.map(item => ({
                name: item.name,
                country: item.country,
                state: item.state || '',
                lat: item.lat,
                lon: item.lon
            }));
        } catch (error) {
            console.error('Fetch suggestions error:', error);
            throw error;
        }
    }

    // Display suggestions
    function displaySuggestions(suggestions) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'block';

        suggestions.forEach((suggestion, index) => {
            const suggestionEl = document.createElement('div');
            suggestionEl.className = 'suggestion-item';
            suggestionEl.style.setProperty('--order', index);
            suggestionEl.textContent = `${suggestion.name}${suggestion.state ? ', ' + suggestion.state : ''}, ${suggestion.country}`;
            suggestionEl.addEventListener('click', () => {
                searchInput.value = suggestion.name;
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
                getWeatherByCity(suggestion.name);
            });
            suggestionsContainer.appendChild(suggestionEl);
        });
    }

    // Theme toggle
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'day';
        const newTheme = currentTheme === 'day' ? 'night' : 'day';
        document.documentElement.setAttribute('data-theme', newTheme);
        themeToggleBtn.innerHTML = `<i class="fas fa-${newTheme === 'day' ? 'moon' : 'sun'}"></i>`;
        localStorage.setItem('theme', newTheme);
        updateChartColors();
        updateBackground(currentWeatherData?.current.weather[0].main);
    }

    // Load theme
    function loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'day';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggleBtn.innerHTML = `<i class="fas fa-${savedTheme === 'day' ? 'moon' : 'sun'}"></i>`;
    }
    
    // Update body background
    function updateBackground(weatherMain) {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'day';
        let background;
        
        const rainConditions = ['Rain', 'Drizzle', 'Thunderstorm'];
        const cloudyConditions = ['Clouds'];
        const sunnyConditions = ['Clear'];
        
        if (rainConditions.includes(weatherMain)) {
            background = currentTheme === 'day' 
                ? 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.8), rgba(var(--danger-rgb), 0.6))'
                : 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.8), rgba(var(--danger-rgb), 0.6))';
        } else if (cloudyConditions.includes(weatherMain)) {
            background = currentTheme === 'day' 
                ? 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.7), rgba(var(--text-secondary-rgb), 0.6))'
                : 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.7), rgba(var(--text-secondary-rgb), 0.6))';
        } else if (sunnyConditions.includes(weatherMain)) {
            background = currentTheme === 'day' 
                ? 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.9), rgba(var(--accent-rgb), 0.7))'
                : 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.9), rgba(var(--secondary-rgb), 0.7))';
        } else {
            background = currentTheme === 'day' 
                ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
                : 'linear-gradient(135deg, var(--primary), var(--secondary))';
        }
        
        document.body.style.background = background;
    }
    
    // Toggle chart datasets
    function toggleChartData(type) {
        if (type === 'temp') {
            showTemp = !showTemp;
            document.getElementById('toggle-temp').classList.toggle('active', showTemp);
        } else if (type === 'feelsLike') {
            showFeelsLike = !showFeelsLike;
            document.getElementById('toggle-feels-like').classList.toggle('active', showFeelsLike);
        } else if (type === 'humidity') {
            showHumidity = !showHumidity;
            document.getElementById('toggle-humidity').classList.toggle('active', showHumidity);
        }
        updateChartColors();
    }

    // Render temperature chart
    function renderTemperatureChart(temperatures, feelsLikeTemps, humidities, labels, annotations) {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'day';
        const colors = {
            day: {
                temp: 'rgb(var(--primary-rgb))', // Neon cyan
                feelsLike: 'rgb(var(--secondary-rgb))', // Neon pink
                humidity: 'rgb(var(--accent-rgb))', // Neon lime
                background: 'rgba(var(--card-bg-rgb, 240, 250, 255), 0.9)', // Translucent cyan
                grid: 'rgba(var(--glow-rgb), 0.2)',
                text: 'rgb(var(--text-primary-rgb, 27, 27, 63))'
            },
            night: {
                temp: 'rgb(var(--accent-rgb))', // Neon teal (brighter for visibility)
                feelsLike: 'rgb(var(--secondary-rgb))', // Neon purple
                humidity: 'rgb(var(--accent-rgb))', // Neon teal
                background: 'rgba(40, 50, 70, 0.9)', // Lighter navy for contrast
                grid: 'rgba(var(--glow-rgb), 0.4)', // Increased opacity
                text: 'rgb(var(--text-primary-rgb, 230, 250, 255))' // Pale cyan-white
            }
        };

        if (temperatureChart) {
            temperatureChart.destroy();
        }

        const datasets = [];
        if (showTemp) {
            datasets.push({
                label: 'Temperature',
                data: temperatures,
                borderColor: colors[currentTheme].temp,
                fill: false,
                borderWidth: 3,
                pointBackgroundColor: colors[currentTheme].temp,
                pointBorderColor: colors[currentTheme].temp,
                pointHoverBackgroundColor: colors[currentTheme].temp,
                pointHoverBorderColor: colors[currentTheme].temp,
                tension: 0.4
            });
        }
        if (showFeelsLike) {
            datasets.push({
                label: 'Feels Like',
                data: feelsLikeTemps,
                borderColor: colors[currentTheme].feelsLike,
                fill: false,
                borderWidth: 3,
                pointBackgroundColor: colors[currentTheme].feelsLike,
                pointBorderColor: colors[currentTheme].feelsLike,
                pointHoverBackgroundColor: colors[currentTheme].feelsLike,
                pointHoverBorderColor: colors[currentTheme].feelsLike,
                tension: 0.4
            });
        }
        if (showHumidity) {
            datasets.push({
                label: 'Humidity (%)',
                data: humidities,
                borderColor: colors[currentTheme].humidity,
                fill: false,
                borderWidth: 3,
                pointBackgroundColor: colors[currentTheme].humidity,
                pointBorderColor: colors[currentTheme].humidity,
                pointHoverBackgroundColor: colors[currentTheme].humidity,
                pointHoverBorderColor: colors[currentTheme].humidity,
                tension: 0.4,
                yAxisID: 'y-humidity'
            });
        }

        temperatureChart = new Chart(temperatureChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                legend: {
                    display: true,
                    labels: {
                        fontColor: colors[currentTheme].text,
                        fontSize: window.innerWidth < 600 ? 12 : 16, // Increased for night mode
                        fontStyle: currentTheme === 'night' ? 'bold' : 'normal' // Bolder in night mode
                    }
                },
                scales: {
                    xAxes: [{
                        gridLines: { color: colors[currentTheme].grid, lineWidth: 1 },
                        ticks: {
                            fontColor: colors[currentTheme].text,
                            fontSize: window.innerWidth < 600 ? 10 : 14, // Slightly larger
                            fontStyle: currentTheme === 'night' ? 'bold' : 'normal'
                        }
                    }],
                    yAxes: [
                        {
                            id: 'y-temperature',
                            gridLines: { color: colors[currentTheme].grid, lineWidth: 1 },
                            ticks: {
                                fontColor: colors[currentTheme].text,
                                fontSize: window.innerWidth < 600 ? 10 : 14,
                                fontStyle: currentTheme === 'night' ? 'bold' : 'normal',
                                callback: function(value) {
                                    return value + (currentUnit === 'celsius' ? '°C' : '°F');
                                }
                            }
                        },
                        {
                            id: 'y-humidity',
                            position: 'right',
                            display: showHumidity,
                            gridLines: { display: false },
                            ticks: {
                                fontColor: colors[currentTheme].text,
                                fontSize: window.innerWidth < 600 ? 10 : 14,
                                fontStyle: currentTheme === 'night' ? 'bold' : 'normal',
                                callback: function(value) {
                                    return value + '%';
                                },
                                max: 100,
                                min: 0
                            }
                        }
                    ]
                },
                tooltips: {
                    backgroundColor: colors[currentTheme].background,
                    titleFontColor: colors[currentTheme].text,
                    bodyFontColor: colors[currentTheme].text,
                    borderColor: colors[currentTheme].temp,
                    borderWidth: 1,
                    titleFontSize: window.innerWidth < 600 ? 12 : 14,
                    bodyFontSize: window.innerWidth < 600 ? 10 : 12,
                    callbacks: {
                        label: function(tooltipItem, data) {
                            const dataset = data.datasets[tooltipItem.datasetIndex];
                            const value = tooltipItem.yLabel;
                            const label = dataset.label;
                            const weather = currentWeatherData.forecast.list.find(item => {
                                const date = new Date(item.dt * 1000);
                                return date.toLocaleDateString('en-US', { weekday: 'short' }) === tooltipItem.xLabel;
                            });
                            return [
                                `${label}: ${value}${label === 'Humidity (%)' ? '%' : (currentUnit === 'celsius' ? '°C' : '°F')}`,
                                `Condition: ${weather?.weather[0].description || 'N/A'}`,
                                `Time: ${weather ? new Date(weather.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric' }) : 'N/A'}`
                            ];
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutCubic',
                    onComplete: function() {
                        const chart = this.chart;
                        const ctx = chart.ctx;
                        ctx.shadowColor = colors[currentTheme].temp;
                        ctx.shadowBlur = 10;
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }
                },
                plugins: {
                    annotation: {
                        annotations: annotations
                    }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    // Update chart colors
    function updateChartColors() {
        if (currentWeatherData) {
            const { temperatures, feelsLikeTemps, humidities, labels, annotations } = collectForecastData(currentWeatherData.forecast);
            renderTemperatureChart(temperatures, feelsLikeTemps, humidities, labels, annotations);
        }
    }

    // Collect forecast data
    function collectForecastData(forecastData) {
        const dailyForecasts = {};
        forecastData.list.forEach(item => {
            const date = new Date(item.dt * 1000);
            const dayKey = date.toLocaleDateString('en-US', { weekday: 'long', month: 'numeric', day: 'numeric' });
            if (!dailyForecasts[dayKey]) {
                dailyForecasts[dayKey] = {
                    date: date,
                    items: []
                };
            }
            dailyForecasts[dayKey].items.push(item);
        });

        const temperatures = [];
        const feelsLikeTemps = [];
        const humidities = [];
        const labels = [];
        const annotations = [];
        const days = Object.keys(dailyForecasts).slice(0, 6);

        days.forEach((dayKey, index) => {
            const dayItems = dailyForecasts[dayKey].items;
            const middayForecast = dayItems.find(item => {
                const hour = new Date(item.dt * 1000).getHours();
                return hour >= 11 && hour <= 14;
            }) || dayItems[Math.floor(dayItems.length / 2)] || dayItems[0];
            
            const temp = currentUnit === 'celsius' ? middayForecast.main.temp : (middayForecast.main.temp * 9/5) + 32;
            const feelsLike = currentUnit === 'celsius' ? middayForecast.main.feels_like : (middayForecast.main.feels_like * 9/5) + 32;
            temperatures.push(Math.round(temp));
            feelsLikeTemps.push(Math.round(feelsLike));
            humidities.push(middayForecast.main.humidity);
            labels.push(dailyForecasts[dayKey].date.toLocaleDateString('en-US', { weekday: 'short' }));

            if (middayForecast.weather[0].main.toLowerCase().includes('rain')) {
                annotations.push({
                    type: 'point',
                    xValue: index,
                    yValue: Math.round(temp),
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    radius: 10,
                    borderColor: 'rgba(0, 0, 0, 0.5)',
                    borderWidth: 1,
                    content: '☔'
                });
            }
        });

        return { temperatures, feelsLikeTemps, humidities, labels, annotations };
    }

    // Initialize app
    function initApp() {
        loadTheme();
        updateTime();
        timeUpdateInterval = setInterval(updateTime, 1000);
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    getWeatherByCoords(position.coords.latitude, position.coords.longitude);
                },
                error => {
                    console.error('Geolocation error:', error.message);
                    getWeatherByCity('London');
                }
            );
        } else {
            getWeatherByCity('London');
        }
    }
    
    function updateTime() {
        const now = new Date();
        dateTimeEl.textContent = now.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    function searchWeather() {
        const city = searchInput.value.trim();
        if (city) {
            getWeatherByCity(city);
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'none';
        } else {
            showError('Please enter a city name.');
        }
    }
    
    function getLocationWeather() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    getWeatherByCoords(position.coords.latitude, position.coords.longitude);
                },
                error => {
                    showError('Please enable location access to use this feature.');
                }
            );
        } else {
            showError('Geolocation is not supported by your browser.');
        }
    }
    
    function refreshWeather() {
        if (lastSearchedCity) {
            getWeatherByCity(lastSearchedCity);
        } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    getWeatherByCoords(position.coords.latitude, position.coords.longitude);
                },
                error => {
                    showError('Could not refresh weather data.');
                }
            );
        } else {
            showError('No previous search or location available to refresh.');
        }
    }
    
    function startAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        refreshInterval = setInterval(() => {
            refreshWeather();
        }, 900000);
    }
    
    async function getWeatherByCity(city) {
        showLoading();
        lastSearchedCity = city;
        
        try {
            const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`;
            console.log('Fetching current weather:', currentUrl);
            const currentResponse = await fetch(currentUrl);
            
            if (!currentResponse.ok) {
                const errorBody = await currentResponse.text();
                console.error('Current weather error response:', { status: currentResponse.status, body: errorBody });
                if (currentResponse.status === 401) {
                    throw new Error('Invalid API key. Please verify your OpenWeatherMap API key.');
                }
                if (currentResponse.status === 404) throw new Error('City not found.');
                if (currentResponse.status === 429) throw new Error('API rate limit exceeded.');
                throw new Error(`HTTP error! Status: ${currentResponse.status}`);
            }
            
            const currentData = await currentResponse.json();
            
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`;
            console.log('Fetching forecast:', forecastUrl);
            const forecastResponse = await fetch(forecastUrl);
            
            if (!forecastResponse.ok) {
                const errorBody = await forecastResponse.text();
                console.error('Forecast error response:', { status: forecastResponse.status, body: errorBody });
                throw new Error(`HTTP error! Status: ${forecastResponse.status}`);
            }
            
            const forecastData = await forecastResponse.json();
            
            currentWeatherData = {
                current: currentData,
                forecast: forecastData
            };
            
            updateWeatherDisplay(currentWeatherData);
            hideError();
            
            const now = new Date();
            lastUpdatedEl.textContent = `Last updated: ${now.toLocaleTimeString()}`;
            startAutoRefresh();
        } catch (error) {
            console.error('Weather fetch error:', error.message);
            showError(error.message || 'Failed to fetch weather data.');
        } finally {
            hideLoading();
        }
    }
    
    async function getWeatherByCoords(lat, lon) {
        showLoading();
        
        try {
            const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
            console.log('Fetching current weather by coords:', currentUrl);
            const currentResponse = await fetch(currentUrl);
            
            if (!currentResponse.ok) {
                const errorBody = await currentResponse.text();
                console.error('Current weather error response by coords:', { status: currentResponse.status, body: errorBody });
                throw new Error(`HTTP error! Status: ${currentResponse.status}`);
            }
            
            const currentData = await currentResponse.json();
            
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
            console.log('Fetching forecast by coords:', forecastUrl);
            const forecastResponse = await fetch(forecastUrl);
            
            if (!forecastResponse.ok) {
                const errorBody = await forecastResponse.text();
                console.error('Forecast error response by coords:', { status: forecastResponse.status, body: errorBody });
                throw new Error(`HTTP error! Status: ${forecastResponse.status}`);
            }
            
            const forecastData = await forecastResponse.json();
            
            currentWeatherData = {
                current: currentData,
                forecast: forecastData
            };
            
            lastSearchedCity = currentData.name;
            updateWeatherDisplay(currentWeatherData);
            hideError();
            
            const now = new Date();
            lastUpdatedEl.textContent = `Last updated: ${now.toLocaleTimeString()}`;
            startAutoRefresh();
        } catch (error) {
            console.error('Weather fetch error by coords:', error.message);
            showError(error.message || 'Failed to fetch weather data.');
        } finally {
            hideLoading();
        }
    }
    
    function updateWeatherDisplay(data) {
        const current = data.current;
        const forecast = data.forecast;
        
        updateBackground(current.weather[0].main);
        
        locationEl.textContent = `${current.name}, ${current.sys.country}`;
        weatherIcon.src = `https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`;
        weatherIcon.alt = current.weather[0].description;
        updateTemperature(current.main.temp);
        weatherDesc.textContent = current.weather[0].description;
        
        if (currentUnit === 'celsius') {
            feelsLikeEl.textContent = `${Math.round(current.main.feels_like)}°C`;
        } else {
            feelsLikeEl.textContent = `${Math.round((current.main.feels_like * 9/5) + 32)}°F`;
        }
        
        humidityEl.textContent = `${current.main.humidity}%`;
        windSpeedEl.textContent = `${Math.round(current.wind.speed * 3.6)} km/h`;
        const uvIndex = Math.min(Math.floor(current.main.temp / 5), 10);
        uvIndexEl.textContent = uvIndex;
        
        updateForecast(forecast);
        weatherDisplay.style.display = 'flex';
    }
    
    function updateForecast(forecastData) {
        forecastItems.innerHTML = '';
        
        const dailyForecasts = {};
        forecastData.list.forEach(item => {
            const date = new Date(item.dt * 1000);
            const dayKey = date.toLocaleDateString('en-US', { weekday: 'long', month: 'numeric', day: 'numeric' });
            if (!dailyForecasts[dayKey]) {
                dailyForecasts[dayKey] = {
                    date: date,
                    items: []
                };
            }
            dailyForecasts[dayKey].items.push(item);
        });
        
        const days = Object.keys(dailyForecasts).slice(0, 6);
        
        days.forEach((dayKey, index) => {
            const dayData = dailyForecasts[dayKey];
            const date = dayData.date;
            const dayItems = dayData.items;
            
            let middayForecast = dayItems.find(item => {
                const hour = new Date(item.dt * 1000).getHours();
                return hour >= 11 && hour <= 14;
            }) || dayItems[Math.floor(dayItems.length / 2)] || dayItems[0];
            
            const temp = currentUnit === 'celsius' ? middayForecast.main.temp : (middayForecast.main.temp * 9/5) + 32;
            
            const forecastItem = document.createElement('div');
            forecastItem.className = 'forecast-item';
            forecastItem.style.setProperty('--order', index);
            
            forecastItem.innerHTML = `
                <div class="forecast-day">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div class="forecast-date">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <img class="forecast-icon" src="https://openweathermap.org/img/wn/${middayForecast.weather[0].icon}.png" alt="${middayForecast.weather[0].description}">
                <div class="forecast-temp">${Math.round(temp)}°</div>
                <div class="forecast-desc">${middayForecast.weather[0].description}</div>
            `;
            
            forecastItems.appendChild(forecastItem);
        });

        const { temperatures, feelsLikeTemps, humidities, labels, annotations } = collectForecastData(forecastData);
        renderTemperatureChart(temperatures, feelsLikeTemps, humidities, labels, annotations);
    }
    
    function toggleUnits(unit) {
        currentUnit = unit;
        
        if (unit === 'celsius') {
            celsiusBtn.classList.add('active');
            fahrenheitBtn.classList.remove('active');
        } else {
            celsiusBtn.classList.remove('active');
            fahrenheitBtn.classList.add('active');
        }
        
        if (currentWeatherData) {
            const temp = currentWeatherData.current.main.temp;
            const feelsLike = currentWeatherData.current.main.feels_like;
            
            if (unit === 'celsius') {
                temperatureEl.textContent = Math.round(temp);
                feelsLikeEl.textContent = `${Math.round(feelsLike)}°C`;
                document.querySelectorAll('.forecast-temp').forEach(el => {
                    const tempValue = parseInt(el.textContent);
                    const tempC = Math.round((tempValue - 32) * 5/9);
                    el.textContent = `${tempC}°`;
                });
            } else {
                temperatureEl.textContent = Math.round((temp * 9/5) + 32);
                feelsLikeEl.textContent = `${Math.round((feelsLike * 9/5) + 32)}°F`;
                document.querySelectorAll('.forecast-temp').forEach(el => {
                    const tempValue = parseInt(el.textContent);
                    const tempF = Math.round((tempValue * 9/5) + 32);
                    el.textContent = `${tempF}°`;
                });
            }
            
            document.querySelector('.temp-unit').textContent = unit === 'celsius' ? 'C' : 'F';
            updateChartColors();
        }
    }
    
    function updateTemperature(temp) {
        if (currentUnit === 'celsius') {
            temperatureEl.textContent = Math.round(temp);
        } else {
            temperatureEl.textContent = Math.round((temp * 9/5) + 32);
        }
    }
    
    function showLoading() {
        loading.style.display = 'flex';
        weatherDisplay.style.display = 'none';
        suggestionsContainer.style.display = 'none';
    }
    
    function hideLoading() {
        loading.style.display = 'none';
    }
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        weatherDisplay.style.display = 'none';
        suggestionsContainer.style.display = 'none';
    }
    
    function hideError() {
        errorMessage.style.display = 'none';
    }
});