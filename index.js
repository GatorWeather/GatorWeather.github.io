const weatherForm = document.querySelector(".weatherForm");
const cityInput = document.querySelector(".cityInput");
const card = document.querySelector(".card");
const apiKey = "8e2d81f77bf781eee278d91811303875";
const conditionsContainer = document.querySelector(".conditionsContainer");
const forecastWrapper = document.querySelector(".forecastContainer");
const searchBox = document.querySelector(".searchBox");
const clearBtn = document.querySelector(".clearBtn");
const locationBtn = document.querySelector(".locationBtn");

const suggestions = document.querySelector(".suggestions");
const historyContainer = document.querySelector(".searchHistory");

const hourlyPanel = document.querySelector(".hourlyPanel");
const hourlyList = document.querySelector(".hourlyList");
const healthToggleBtn = document.querySelector(".healthToggleBtn");
const healthIndicatorsContainer = document.querySelector(".healthIndicatorsContainer");

let selectedHourlyMetric = "precipitation";
let selectedWeeklyMetric = "precipitation";


cityInput.addEventListener("input", async () => {
    historyContainer.innerHTML = "";
    const query = cityInput.value;
    searchBox.classList.toggle("hasText", query.trim().length > 0);

    if(query.length < 2){
        suggestions.innerHTML = "";
        return;
    }

    try {
        const response = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${apiKey}`);
        const cities = await response.json();
        displayCitySuggestions(cities);
    } 
    
    catch (error) {
        console.error(error)
    }
    

});

cityInput.addEventListener("focus", () => {
    if (cityInput.value.trim() === "") {
        displaySearchHistory();
    }
});

cityInput.addEventListener("blur", () => {
    setTimeout(() => {
        suggestions.innerHTML = "";
        historyContainer.innerHTML = "";}, 100);
})

if (healthToggleBtn) {
    healthToggleBtn.addEventListener("click", () => {
        const willOpen = !healthIndicatorsContainer.classList.contains("show");
        setHealthToggleState(willOpen);
    });
}

weatherForm.addEventListener("submit", async event => {
    event.preventDefault();
    const city = cityInput.value.trim();
    suggestions.innerHTML = "";
    cityInput.blur();

    if (!city) {
        displayError("Please enter a city name or ZIP code");
        return;
    }

    try {
        // zip code search
    if (!isNaN(city)) {
        if (city.length !== 5) throw new Error("Invalid ZIP code, enter 5 digits.");
        const zipGeoResponse = await fetch(
            `https://api.openweathermap.org/geo/1.0/zip?zip=${city},US&appid=${apiKey}`
        );
        if (!zipGeoResponse.ok) throw new Error("Invalid ZIP code or not found.");
        const zipData = await zipGeoResponse.json();
        // zipData does not contain the state name so use get it with the reverse geocoding api

        let stateName = "";
        try {
            const reverseGeoResponse = await fetch(
                `https://api.openweathermap.org/geo/1.0/reverse?lat=${zipData.lat}&lon=${zipData.lon}&limit=1&appid=${apiKey}`
            );
            const reverseData = await reverseGeoResponse.json();
            
            // if it finds a match, pull the state property
            if (reverseData.length > 0 && reverseData[0].state) {
                stateName = reverseData[0].state;
            }
        } catch (err) {
            console.error("Could not fetch state name for ZIP:", err);
        }

        fetchAndDisplayAllWeather(zipData.lat, zipData.lon, zipData.name, stateName, zipData.country);
        return;
    }

        // city name — check for duplicates first
        const geoResponse = await fetch(
            `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=5&appid=${apiKey}`
        );
        const matches = await geoResponse.json();

        if (matches.length === 0) {
            displayError("City not found");
            return;
        }

        // if only one match, or all matches are the same country+state, just use the first
        const unique = matches.filter((m, i, arr) =>
            arr.findIndex(x => x.state === m.state && x.country === m.country) === i
        );

        if (unique.length === 1) {
            fetchAndDisplayAllWeather(matches[0].lat, matches[0].lon, matches[0].name, matches[0].state, matches[0].country);
        } else {
            // show disambiguation list
            displayCitySuggestions(unique);
        }
    } catch (error) {
        console.error(error);
        displayError(error.message);
    }
});

clearBtn.addEventListener("click", () => {
    cityInput.value = "";
    searchBox.classList.remove("hasText"); 
    cityInput.focus();
});

locationBtn.addEventListener("click", () => {
    // Check if browser supports geolocation
    if (!navigator.geolocation) {
        displayError("Geolocation is not supported by your browser.");
        return; 
    }
    navigator.geolocation.getCurrentPosition(showGeolocationWeather, handleGeolocationErrors);
});

// ----- Functions for using current Geolocation -----
function handleGeolocationErrors(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            displayError("Location permission was denied.");
            break;
        case error.POSITION_UNAVAILABLE:
            displayError("Location information is unavailable.");           
            break;
        case error.TIMEOUT:
            displayError("Location request timed out.");
            break;
        case error.UNKNOWN_ERROR:
            displayError("An unknown location error occurred."); 
            break;
    }
}

async function showGeolocationWeather(position) {
    try {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        // Clear search box
        cityInput.value = "";
        searchBox.classList.remove("hasText");
        suggestions.innerHTML = "";
        cityInput.blur();

        // Fetch and display weather data
        await fetchAndDisplayAllWeather(lat, lon, "", "", "");
        
    } 
    catch (error) {
        console.error("Geolocation Weather Error:", error);
        displayError("Could not fetch weather data for your location.");
    }
}

// ----- Functions for user seach history -----

/*
    Saves a location to sessionStorage.
    Keeps most recent searches at the top.
    Removes duplicates by exact lat and lon, to allow for cities with the same name.
    Limits history to 5 items.
*/ 
function saveSearchHistory(name, state, country, lat, lon) {
    let searchHistory = JSON.parse(sessionStorage.getItem("searchHistory")) || [];

    const newEntry = {name, state, country,  lat, lon};

    // filter out duplicates
    searchHistory = searchHistory.filter(item => (item.lat != lat && item.lon != lon));

    searchHistory.unshift(newEntry);

    // keep only the 5 most recent searches
    searchHistory = searchHistory.slice(0, 5);

    sessionStorage.setItem("searchHistory", JSON.stringify(searchHistory));
}

function displaySearchHistory() {
    let searchHistory = JSON.parse(sessionStorage.getItem("searchHistory")) || [];

    historyContainer.innerHTML = "";
    suggestions.innerHTML = "";

    if (searchHistory.length === 0) {
        const message = document.createElement("div");
        message.classList.add("searchHistoryItem");
        message.style.opacity = "0.5";
        message.textContent = "No recent searches";
        historyContainer.appendChild(message);
        return;
    }

    searchHistory.forEach (item => {
        const div = document.createElement("div");
        div.classList.add("searchHistoryItem");
        div.textContent = `${item.name}${item.state ? ', ' + item.state : ''} ${item.country}`;

        // TODO 
        // add name state and country to cityInput once it can allow that longer input
        div.addEventListener("click", () => {
            cityInput.value = item.name;
            historyContainer.innerHTML = "";
            fetchAndDisplayAllWeather(item.lat, item.lon, item.name, item.state, item.country);
        });
        historyContainer.appendChild(div);
    }) ;
}

// get weather data by coordinates
async function getWeatherDataByCoords(lat, lon) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error("Could not fetch weather data");
    }
    return await response.json();
}

function displayWeatherInfo(data, locationData = null){
    
    const {name: city, 
        main: {temp, feels_like, humidity, pressure},
        wind: {speed},
        weather: [{description, id}],
        sys: {sunrise, sunset, country}
     } = data;

    const cityDisplay = document.createElement("h1");
    const regionDisplay = document.createElement("div");
    const tempDisplay = document.createElement("p");
    const weatherEmoji = document.createElement("p");

    cityDisplay.textContent = locationData ? (locationData.name || city) : city;

    let regionParts = [];
    if (locationData && locationData.state) regionParts.push(locationData.state);
    if (locationData && locationData.country) {
        regionParts.push(locationData.country);
    } else if (country) {
        regionParts.push(country);
    }

    regionDisplay.textContent = regionParts.join(", ");
    regionDisplay.classList.add("regionDisplay");

    tempDisplay.textContent = `${temp.toFixed(1)}°F`;
    weatherEmoji.innerHTML = `
        <div class="emoji">${getWeatherEmoji(id, sunrise, sunset)}</div>
        <div class="desc">${description}</div>
    `;

    tempDisplay.classList.add("tempDisplay");
    weatherEmoji.classList.add("weatherEmoji");

    
    card.textContent = "";
    card.style.display = "flex";
    card.style.flexDirection = "row";
    card.style.justifyContent = "space-between";
    card.style.alignItems = "center";

    setWeatherTheme(id, sunrise, sunset);

    const leftSide = document.createElement("div");
    leftSide.style.display = "flex";
    leftSide.style.flexDirection = "column";
    leftSide.style.alignItems = "flex-start";
    leftSide.appendChild(weatherEmoji);
    leftSide.appendChild(tempDisplay);

    const rightSide = document.createElement("div");
    rightSide.style.textAlign = "left";
    rightSide.style.display = "flex";
    rightSide.style.flexDirection = "column";
    rightSide.style.justifyContent = "center";
    
    rightSide.appendChild(cityDisplay);
    if (regionParts.length > 0) {
        rightSide.appendChild(regionDisplay);
    }

    card.appendChild(rightSide);    
    card.appendChild(leftSide);
    

    // conditions grid
    const list = document.createElement("ul");

    const humidityItem = document.createElement("li");
    humidityItem.innerHTML = `
        <i class="fa-solid fa-droplet"></i>
        Humidity: ${humidity}%
    `;

    const pressureItem = document.createElement("li");
    pressureItem.innerHTML = `
        <i class="fa-solid fa-gauge"></i>
        Pressure: ${pressure} hPa
    `;

    const windItem = document.createElement("li");
    windItem.innerHTML = `
        <i class="fa-solid fa-wind"></i>
        Wind: ${speed} mph
    `;

    const feelsLikeItem = document.createElement("li");
    feelsLikeItem.innerHTML = `
        <i class="fa-solid fa-temperature-half"></i>
        Feels Like: ${feels_like.toFixed(1)}°F`;

    list.appendChild(humidityItem); 
    list.appendChild(pressureItem); 
    list.appendChild(windItem);
    list.appendChild(feelsLikeItem);
    
    conditionsContainer.textContent = "";
    conditionsContainer.appendChild(list);
}

function getWeatherEmoji(weatherId, sunrise, sunset){
     // day/night using sunrise/sunset. 

     const now = Math.floor(Date.now() / 1000);
     const isDay = (sunrise && sunset) ? (now >= sunrise && now < sunset) : true;

     if (weatherId >= 200 && weatherId < 300)
            return "⛈️";   // thunderstorm

    if  (weatherId >= 300 && weatherId < 600)
            return "🌧️";   // drizzle
            
    if (weatherId >= 600 && weatherId < 700)
            return "❄️";   // snow
    
    if (weatherId >= 700 && weatherId < 800)
            return "🌫️";   // fog / atmosphere

    if (weatherId === 800)
            return isDay ? "☀️" : "🌙";

    if (weatherId === 801 || weatherId === 802)
            return isDay ? "🌤️" : "☁️";

    if (weatherId === 803 || weatherId === 804)
            return  isDay ? "🌥️" : "☁️";

        return "❓";   // unknown
}

function setWeatherTheme(weatherId, sunrise, sunset){

    const now = Math.floor(Date.now() / 1000);
    const isDay = (sunrise && sunset) ? (now >= sunrise && now < sunset) : true;

    if(weatherId >= 200 && weatherId < 600){
        card.style.background = isDay 
        ? "linear-gradient(#8aa2ff, #5b6ed6)" 
        : "linear-gradient(#4a5a8a, #2f3d66)"; 
    }
    else if(weatherId >= 600 && weatherId < 700){
        card.style.background = isDay
        ? "linear-gradient(#e0f3ff, #b8d9ff)" 
        : "linear-gradient(#95a9c7, #63738d)"; 
    }
    else if(weatherId === 800){
        card.style.background = isDay
        ? "linear-gradient(#ffd76a, #ffb347)" 
        : "linear-gradient(#1e2a44, #3b4f7a)"; 
    }
    else if(weatherId > 800){
        card.style.background = isDay
        ? "linear-gradient(#d7d7d7, #a8a8a8)" 
        : "linear-gradient(#5c6470, #3e4652)"; 
    }
}

function displayError(message){

    const errorDisplay = document.createElement("p");
    errorDisplay.textContent = message;
    errorDisplay.classList.add("errorDisplay");

    card.textContent = "";
    card.style.display = "flex";
    card.appendChild(errorDisplay);

    conditionsContainer.textContent = "";
    forecastWrapper.textContent = "";
    hourlyList.innerHTML = "";
    hourlyPanel.style.display = "none";
    clearHealthIndicators();
}

function getForecastMetricOptions() {
    return [
        { value: "precipitation", label: "Precipitation" },
        { value: "humidity", label: "Humidity" },
        { value: "pressure", label: "Pressure" },
        { value: "wind", label: "Wind" },
        { value: "feelsLike", label: "Feels Like" },
        { value: "uvi", label: "UV Index"},
        { value: "aqi", label: "Air Quality Index"}
    ];
}

function getMetricValueForHour(hourlyData, metric, index) {
    let value;
    switch(metric) {
        case "precipitation":
            value = hourlyData.hourly.precipitation_probability?.[index];
            return Number.isFinite(value) ? `${Math.round(value)}%` : "--";

        case "humidity":
            value = hourlyData.hourly.relative_humidity_2m?.[index];
            return Number.isFinite(value) ? `${Math.round(value)}%` : "--";

        case "pressure":
            value = hourlyData.hourly.surface_pressure?.[index];
            return Number.isFinite(value) ? `${Math.round(value)} hPa` : "--";

        case "wind":
            value = hourlyData.hourly.wind_speed_10m?.[index];
            return Number.isFinite(value) ? `${Math.round(value)} mph` : "--";

        case "feelsLike":
            value = hourlyData.hourly.apparent_temperature?.[index];
            return Number.isFinite(value) ? `${Math.round(value)}°F` : "--";

        case "uvi":
            value = hourlyData.hourly.uv_index?.[index];
            return Number.isFinite(value) ? `${Number(value).toFixed(1)}` : "--";

        case "aqi":
            value = hourlyData.hourly.us_aqi?.[index];
            return Number.isFinite(value) ? `${Math.round(value)}` : "--";

        default:
            value = hourlyData.hourly.precipitation_probability?.[index];
            return Number.isFinite(value) ? `${Math.round(value)}%` : "--";
    }
}

function getMetricDailyAverage(hourlyData, metric, dateString) {
    const times = hourlyData.hourly.time;
    let total = 0;
    let count = 0;

    for (let i = 0; i < times.length; i++) {
        if (!times[i].startsWith(dateString)) continue;

        let value;

        switch(metric) {
            case "precipitation":
                value = hourlyData.hourly.precipitation_probability[i];
                break;
            case "humidity":
                value = hourlyData.hourly.relative_humidity_2m[i];
                break;
            case "pressure":
                value = hourlyData.hourly.surface_pressure[i];
                break;
            case "wind":
                value = hourlyData.hourly.wind_speed_10m[i];
                break;
            case "feelsLike":
                value = hourlyData.hourly.apparent_temperature[i];
                break;
            case "uvi":
                value = hourlyData.hourly.uv_index[i];
                break;
            case "aqi":
                value = hourlyData.hourly.us_aqi[i];
                break;
            default:
                value = hourlyData.hourly.precipitation_probability[i];
        }

        if (Number.isFinite(value)) {
            total += value;
            count++;
        }
    }

    if (count == 0) return "--";
    const average = total / count;

    switch (metric) {
        case "precipitation":
        case "humidity":
            return `${Math.round(average)}%`;
        
        case "pressure":
            return `${Math.round(average)} hPa`;
        
        case "wind":
            return `${Math.round(average)} mph`;
        
        case "feelsLike":
            return `${Math.round(average)}°F`;
        
        case "uvi":
            return `${average.toFixed(1)}`;

        case "aqi":
            return `${Math.round(average)}`;
        
        default:
            return `${Math.round(average)}%`;
    }
}

function createMetricDropdown(selectedValue, onChange) {
    const select = document.createElement("select");
    select.classList.add("forecastMetricSelect");

    getForecastMetricOptions().forEach(option => {
        const optionEl = document.createElement("option");
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        optionEl.selected = option.value === selectedValue;
        select.appendChild(optionEl);
    });

    select.addEventListener("change", onChange);
    return select;
}

async function getForecastData(lat, lon){
    // one call 7 day for case using condinates. 
    const apiUrl = 
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + lat +
    "&longitude=" + lon +
    "&daily=weathercode,temperature_2m_max,temperature_2m_min" +
    "&hourly=precipitation_probability,relative_humidity_2m,surface_pressure,wind_speed_10m,apparent_temperature,uv_index" +
    "&temperature_unit=fahrenheit" +
    "&wind_speed_unit=mph" +
    "&timezone=auto" +
    "&forecast_days=7";

    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error("Could not fetch forecast data");
    }
    return await response.json();
}

async function getHourlyForecastData(lat, lon){
    const apiUrl = "https://api.open-meteo.com/v1/forecast" +
"?latitude=" + lat +
"&longitude=" + lon +
"&hourly=temperature_2m,weathercode,precipitation_probability,relative_humidity_2m,surface_pressure,wind_speed_10m,apparent_temperature,uv_index,is_day" +
"&temperature_unit=fahrenheit" +
"&wind_speed_unit=mph" +
"&timezone=auto" +
"&forecast_days=2";

const response = await fetch(apiUrl);
if (!response.ok) {
    throw new Error("Could not fetch hourly forecast data");
}
return await response.json();
}

async function getHealthIndicatorData(lat, lon){
    const apiUrl = 
    "https://air-quality-api.open-meteo.com/v1/air-quality" +
        "?latitude=" + lat +
        "&longitude=" + lon +
        "&current=us_aqi,uv_index" +
        "&timezone=auto" +
        "&forecast_days=1";

    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error("Could not fetch health indicator data");
    }
    return await response.json();
}

async function getAirQualityForecastData(lat, lon){
    const apiUrl = 
    "https://air-quality-api.open-meteo.com/v1/air-quality" +
        "?latitude=" + lat +
        "&longitude=" + lon +
        "&hourly=us_aqi" +
        "&timezone=auto" +
        "&forecast_days=7";

    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error("Could not fetch air quality forecast data");
    }
    return await response.json();
}

function display7DayForecast(forecastData){
    const oldForecast = document.querySelector(".forecast");
    if (oldForecast){
        oldForecast.remove();
    }

    const forecastContainer = document.createElement("div");
    forecastContainer.classList.add("forecast");

    const header = document.createElement("div");
    header.classList.add("forecastHeader");

    const forecastLabel = document.createElement("h2");
    forecastLabel.textContent = "Weekly Forecast";
    forecastLabel.classList.add("forcastTitle");

    const weeklyMetricSelect = createMetricDropdown(selectedWeeklyMetric, event => {
        selectedWeeklyMetric = event.target.value;
        display7DayForecast(forecastData);
    });

    header.appendChild(forecastLabel);
    header.appendChild(weeklyMetricSelect);
    
    const row = document.createElement("div");
    row.classList.add("forecastRow");

    const dates = forecastData.daily.time;
    const highs = forecastData.daily.temperature_2m_max;
    const lows = forecastData.daily.temperature_2m_min;
    const codes = forecastData.daily.weathercode;

    const todayInCity = new Intl.DateTimeFormat("en-CA", {
        timeZone: forecastData.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date()); 

    // find first weekly forecast date that is today or later
    let start = dates.findIndex(date => date >= todayInCity);

    if (start === -1) start = 0; // fallback to first date if all are in the past

    // make 7 day forecast items
    for (let i = start; i < Math.min(start + 7, dates.length); i++){
        const dayCard = document.createElement("div");
        dayCard.classList.add("forecastDay");

        const date = new Date(dates[i] + "T12:00:00"); // use noon to avoid timezone issues
        const dayName = date.toLocaleDateString("en-US", { weekday: "short" });

        const high = Math.round(highs[i]);
        const low = Math.round(lows[i]);
        const metricAverage = getMetricDailyAverage(forecastData, selectedWeeklyMetric, dates[i]);

        const emoji = getForecastEmoji(codes[i], true);

        dayCard.innerHTML = `
            <div class="forecastName">${dayName}</div>
            <div class="forecastEmoji">${emoji}</div>
            <div class="forecastTemps">H: ${high}° <br> L: ${low}°</div>
            <div class="forecastMetricValue">${metricAverage}</div>
        `;
        row.appendChild(dayCard);
    }

    forecastContainer.appendChild(header);
    forecastContainer.appendChild(row);
    forecastWrapper.textContent = "";
    forecastWrapper.appendChild(forecastContainer);
}

function displayHourlyForecast(hourlyData){
    const panel = document.querySelector(".hourlyPanel");
    panel.style.display = "flex";

    const hourlyList = document.querySelector(".hourlyList");
    hourlyList.innerHTML = "";

    const header = document.createElement("div");
    header.classList.add("hourlyHeader");

    const timeHeader = document.createElement("div");
    timeHeader.classList.add("hourlyTime");
    timeHeader.textContent = "Time";

    const forecastHeader = document.createElement("div");
    forecastHeader.classList.add("hourlyEmoji");
    forecastHeader.textContent = "Forecast";

    const metricHeaderWrap = document.createElement("div");
    metricHeaderWrap.classList.add("hourlyRain");

    const hourlyMetricSelect = createMetricDropdown(selectedHourlyMetric, event => {
        selectedHourlyMetric = event.target.value;
        displayHourlyForecast(hourlyData);
    });

    metricHeaderWrap.appendChild(hourlyMetricSelect);

    const tempHeader = document.createElement("div");
    tempHeader.classList.add("hourlyTemp");
    tempHeader.textContent = "Temp";

    header.appendChild(timeHeader);
    header.appendChild(forecastHeader);
    header.appendChild(metricHeaderWrap);
    header.appendChild(tempHeader);

    hourlyList.appendChild(header);

    const times = hourlyData.hourly.time;
    const temps = hourlyData.hourly.temperature_2m;
    const codes = hourlyData.hourly.weathercode;
    const isDayArr = hourlyData.hourly.is_day;

    const now = new Intl.DateTimeFormat("sv-SE", {
        timeZone: hourlyData.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false  
    }).format(new Date()).replace(" ", "T");

    let startIndex = times.findIndex(time => time >= now.slice(0, 13)+":00");
    if (startIndex === -1) startIndex = 0;

    const endIndex = Math.min(startIndex + 24, times.length);

    for (let i = startIndex; i < endIndex; i++){
        const hour24 = Number(times[i].slice(11, 13));
        const label = `${hour24 % 12 || 12} ${hour24 >= 12 ? "PM" : "AM"}`;
        
        const selectedMetricValue = getMetricValueForHour(hourlyData, selectedHourlyMetric, i);

        const emoji = getForecastEmoji(codes[i], isDayArr[i] === 1);

        const item = document.createElement("div");
        item.classList.add("hourlyItem");
        item.innerHTML = `
            <div class="hourlyTime">${label}</div>
            <div class="hourlyEmoji">${emoji}</div>
            <div class="hourlyRain">${selectedMetricValue}</div>
            <div class="hourlyTemp">${Math.round(temps[i])}°F</div>
        `;
        hourlyList.appendChild(item);
    }
}

function displayHealthIndicators(healthData) {
    if (!healthIndicatorsContainer || !healthToggleBtn) return;

    const uvValue = healthData?.current?.uv_index;
    const aqiValue = healthData?.current?.us_aqi;

    if (!Number.isFinite(uvValue) && !Number.isFinite(aqiValue)) {
        clearHealthIndicators();
        return;
    }

    const uvCategory = getUvCategory(uvValue);
    const aqiCategory = getAqiCategory(aqiValue);
    const currentTime = formatHealthTime(healthData?.current?.time);

    healthIndicatorsContainer.innerHTML = `
        <div class="healthIndicatorsPanel">
            <div class="healthIndicatorsHeader">
                <div>
                    <h2 class="healthIndicatorsTitle">Health Indicators</h2>
                    <div class="healthIndicatorsSub">Current UV index and Air Quality${currentTime ? ` at ${currentTime}` : ""}</div>
                </div>
                <i class="fa-solid fa-heart-pulse"></i>
            </div>

            <div class="healthIndicatorsGrid">
                <div class="healthIndicatorCard">
                    <div class="healthIndicatorTop">
                        <div class="healthIndicatorLabelWrap">
                            <div class="healthIndicatorLabel">UV Index</div>
                            <div class="healthIndicatorValue">${formatUvValue(uvValue)}</div>
                        </div>
                        <span class="healthBadge ${getUVBadgeClass(uvCategory.key)}">${uvCategory.label}</span>
                    </div>
                    <p class="healthIndicatorNote">${uvCategory.note}</p>
                </div>
                
                <div class="healthIndicatorCard">
                    <div class="healthIndicatorTop">
                        <div class="healthIndicatorLabelWrap">
                            <div class="healthIndicatorLabel">Air Quality Index</div>
                            <div class="healthIndicatorValue">${formatAQIValue(aqiValue)}</div>
                        </div>
                        <span class="healthBadge ${getAQIBadgeClass(aqiCategory.key)}">${aqiCategory.label}</span>
                    </div>
                    <p class="healthIndicatorNote">${aqiCategory.note}</p>
                </div>
            </div>
        </div>
    `;

    healthToggleBtn.style.display = "flex";
    setHealthToggleState(false);
}

function clearHealthIndicators() {
    if (!healthIndicatorsContainer || !healthToggleBtn) return;

    healthIndicatorsContainer.innerHTML = "";
    healthIndicatorsContainer.classList.remove("show");
    healthToggleBtn.classList.remove("open");
    healthToggleBtn.style.display = "none";
    healthToggleBtn.setAttribute("aria-expanded", "false");

    const toggleText = healthToggleBtn.querySelector(".toggleText");
    if (toggleText) {
        toggleText.textContent = "Show health indicators";
    }
}

function setHealthToggleState(isOpen) {
    if (!healthIndicatorsContainer || !healthToggleBtn) return;

    healthIndicatorsContainer.classList.toggle("show", isOpen);
    healthToggleBtn.classList.toggle("open", isOpen);
    healthToggleBtn.setAttribute("aria-expanded", String(isOpen));

    const toggleText = healthToggleBtn.querySelector(".toggleText");
    if (toggleText) {
        toggleText.textContent = isOpen ? "Hide health indicators" : "Show health indicators";
    }  
}

function formatHealthTime(isoTime) {
    if (!isoTime || !isoTime.includes("T")) return "";

    const timePart = isoTime.split("T")[1];
    const [hourStr, minute = "00"] = timePart.split(":");
    const hour24 = Number(hourStr);

    if (!Number.isFinite(hour24)) return "";

    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
}

function formatUvValue(value) {
    if (!Number.isFinite(value)) return "-";
    return value >= 10 ? Math.round(value) : value.toFixed(1);
}

function formatAQIValue(value) {
    if (!Number.isFinite(value)) return "-";
    return Math.round(value);
}

function getUvCategory(uv) {
    if (!Number.isFinite(uv)) {
        return { 
            key: "unknown", 
            label: "Unavailable", 
            note: "UV index data is unavailable."
        };
    }

    if (uv <= 2) {
        return {
            key: "low",
            label: "Low",
            note: "Minimal sun protection needed."
        };
    }

    if (uv <= 5) {
        return {
            key: "moderate",
            label: "Moderate",
            note: "Consider sunscreen and shade if outside for extended periods."
        };
    }
    if (uv <= 7) {
        return {
            key: "high",
            label: "High",
            note: "Sun protection is recommended, especially around midday."
        };
    }
    if (uv <= 10) {
        return {
            key: "very-high",
            label: "Very High",
            note: "Use shade, sunscreen and protective clothing if outside."
        };
    }
    return {
        key: "extreme",
        label: "Extreme",
        note: "Extra sun protection is strongly recommended."
    };
}

function getAqiCategory(aqi) {
    if (!Number.isFinite(aqi)) {
        return {
            key: "unknown", 
            label: "Unavailable",
            note: "Air quality data is unavailable."
        };
    }

    if (aqi <= 50) {
        return {
            key: "good",
            label: "Good",
            note: "Air quality is satisfactory for most people."
        };
    }

    if (aqi <= 100) {
        return {
            key: "moderate",
            label: "Moderate",
            note: "May affect individuals who are very sensitive to air pollution."
        };
    }

    if (aqi <= 150) {
        return {
            key: "sensitive",
            label: "Unhealthy for Sensitive Groups",
            note: "People with heart or lung conditions, older adults, and children should take precautions."
        };
    }

    if (aqi <= 200) {
        return {
            key: "unhealthy",
            label: "Unhealthy",
            note: "Limit prolonged outdoor exposure."
        };
    }
    
    if (aqi <= 300) {
        return {
            key: "very-unhealthy",
            label: "Very Unhealthy",
            note: "Avoid outdoor activities, especially if you have respiratory or heart conditions."
        };
    }

    return {
        key: "hazardous",
        label: "Hazardous",
        note: "Avoid outdoor activity. Follow local health advice."
    };
}

function getUVBadgeClass(key) {
    switch(key) {
        case "low":
            return "badge-low";
        case "moderate":
            return "badge-moderate";
        case "high":
            return "badge-high";
        case "very-high":
            return "badge-very-high";
        case "extreme":
            return "badge-extreme";
        default:
            return "badge-neutral";
    }
}

function getAQIBadgeClass(key) {
    switch(key) {
        case "good":
            return "badge-good";
        case "moderate":
            return "badge-moderate";
        case "sensitive":
            return "badge-high";
        case "unhealthy":
            return "badge-very-high";
        case "very-unhealthy":
            return "badge-extreme";
        case "hazardous":
            return "badge-hazardous";
        default:
            return "badge-neutral";
    }
}

function getForecastEmoji(code, isDay = true){
    if (code === 0) return isDay ? "☀️" : "🌙";
    if (code === 1 || code === 2) return isDay ? "🌤️" : "☁️";
    if (code === 3) return "☁️";
    if (code === 45 || code === 48) return "🌫️";
    if (code === 51 || code === 53 || code === 55) 
        return isDay ? "🌦️" : "🌧️";
    if (code === 56 || code === 57) 
        return isDay ? "🌦️" : "🌧️";
    if (code === 61 || code === 63 || code === 65) return "🌧️";
    if (code === 66 || code === 67) return "🌧️";
    if(code === 71 || code === 73 || code === 75) return "❄️";
    if (code === 77) return "❄️";
    if (code === 80 || code === 81 || code === 82) 
        return isDay ? "🌦️" : "🌧️";
    if (code === 85 || code === 86) return "❄️";
    if (code === 95 || code === 96 || code === 99) return "⛈️";
        return "❓";
};

async function renderAllWeather(lat, lon, historyEntry = null) {
    const [weatherData, forecastData, hourlyData, healthData, airQualityForecastData] = await Promise.all([
        getWeatherDataByCoords(lat, lon),
        getForecastData(lat, lon),
        getHourlyForecastData(lat, lon),
        getHealthIndicatorData(lat, lon).catch(error => {
            console.error("Health indicator fetch failed:", error);
            return null;
         }),
        getAirQualityForecastData(lat, lon).catch(error => {
            console.error("Air quality forecast fetch failed:", error);
            return null;
         }) 
    ]);

    if (airQualityForecastData?.hourly?.us_aqi) {
        forecastData.hourly.us_aqi = airQualityForecastData.hourly.us_aqi;

        hourlyData.hourly.us_aqi = airQualityForecastData.hourly.us_aqi;
    }

    const resolvedHistoryEntry = historyEntry || {
        name: weatherData?.name || "",
        state: "", 
        country:weatherData?.sys?.country || ""
    };

    if (resolvedHistoryEntry.name) {
        saveSearchHistory(
            resolvedHistoryEntry.name, 
            resolvedHistoryEntry.state, 
            resolvedHistoryEntry.country, 
            lat, 
            lon
        );
    }
    
    displayWeatherInfo(weatherData, resolvedHistoryEntry);
    display7DayForecast(forecastData);
    displayHourlyForecast(hourlyData);
    displayHealthIndicators(healthData);
    showClimateTrackerBtn(lat, lon, weatherData?.main?.temp ?? null);
}

async function fetchAndDisplayAllWeather(lat, lon, cityName, state, country) {
    try {
        await renderAllWeather(lat, lon, {
            name: cityName, 
            state, 
            country
        });
    } catch (error) {
        console.error("Weather Fetch Failed:", error);
        let message = "fetchAndDisplayAllWeather failed";
        if (error.message) {
            message = error.message;
        }
        displayError(message);
    }
}

function displayCitySuggestions(cities) {
    suggestions.innerHTML = "";

    cities.forEach(city => {
        const div = document.createElement("div");
        div.classList.add("suggestionItem");
        
        const locationName = `${city.name}, ${city.state || ""} ${city.country}`;
        div.textContent = locationName;

        div.addEventListener("click", () => {
            cityInput.value = locationName;
            suggestions.innerHTML = "";
            cityInput.blur();
            
            fetchAndDisplayAllWeather(city.lat, city.lon, city.name, city.state, city.country);
        });

        suggestions.appendChild(div);
    });
}

// ── Climate Tracker ──
const climateTrackerBtn = document.querySelector(".climateTrackerBtn");
const climateTrackerContainer = document.querySelector(".climateTrackerContainer");

let climateChart = null;
let climateTrackerLat = null;
let climateTrackerLon = null;
let climateTrackerCurrentTemp = null;
let climateTrackerTodayAvg = null;

if (climateTrackerBtn && climateTrackerContainer) {
    climateTrackerBtn.addEventListener("click", async () => {
        const isOpen = climateTrackerContainer.classList.contains("show");

        if (isOpen) {
            climateTrackerContainer.classList.remove("show");
            climateTrackerBtn.classList.remove("open");
        } else {
            climateTrackerContainer.classList.add("show");
            climateTrackerBtn.classList.add("open");

            setTimeout(async () => {
                if (climateTrackerLat && !climateChart) {
                    await buildClimateChart(climateTrackerLat, climateTrackerLon);
                } else if (climateChart) {
                    climateChart.resize();
                }
            }, 300);
        }
    });
}

// ── ERA DATA ──
const ERAS = [];

// 1940-1980: deep navy blue
for (let y = 1940; y <= 1980; y++) {
    ERAS.push({ label: y.toString(), start: y, end: y, color: "rgba(71, 112, 235, 0.6)", borderWidth: 1 });
}
// 1981-2000: steel blue
for (let y = 1981; y <= 2000; y++) {
    ERAS.push({ label: y.toString(), start: y, end: y, color: "rgba(70, 170, 230, 0.7)", borderWidth: 1 });
}
// 2001-2010: teal
for (let y = 2001; y <= 2010; y++) {
    ERAS.push({ label: y.toString(), start: y, end: y, color: "rgba(0, 200, 180, 0.75)", borderWidth: 1 });
}
// 2011-2020: lime green
for (let y = 2011; y <= 2020; y++) {
    ERAS.push({ label: y.toString(), start: y, end: y, color: "rgba(24, 228, 17, 0.9)", borderWidth: 1.5 });
}
// 2021-2024: yellow
for (let y = 2021; y <= 2024; y++) {
    ERAS.push({ label: y.toString(), start: y, end: y, color: "rgba(240, 210, 0, 0.9)", borderWidth: 2 });
}
// 2025: bold orange
ERAS.push({ label: "2025", start: 2025, end: 2025, color: "rgb(255, 72, 0)", borderWidth: 3.5 });
// 2026: bold red
ERAS.push({ label: "2026", start: 2026, end: 2026, color: "rgb(190, 0, 0)", borderWidth: 3.5 });

async function fetchEraTemps(lat, lon, startYear, endYear) {
    const today = new Date();
    
    // cap end date to yesterday to avoid requesting future data
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const maxDate = yesterday.toISOString().split("T")[0];

    const startDate = `${startYear}-01-01`;
    const rawEnd = `${Math.min(endYear, today.getFullYear())}-12-31`;
    const endDate = rawEnd > maxDate ? maxDate : rawEnd;

    // if start is after end, skip entirely
    if (startDate > endDate) {
        console.warn(`Skipping ${startYear}-${endYear}: no data available yet`);
        return new Array(12).fill(null);
    }

    const url =
        "https://archive-api.open-meteo.com/v1/archive" +
        `?latitude=${lat}&longitude=${lon}` +
        `&start_date=${startDate}&end_date=${endDate}` +
        "&daily=temperature_2m_mean" +
        "&temperature_unit=fahrenheit" +
        "&timezone=auto";

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Climate fetch failed for ${startYear}-${endYear}`);
    const json = await res.json();

    const monthTotals = new Array(12).fill(0);
    const monthCounts = new Array(12).fill(0);

    json.daily.time.forEach((dateStr, i) => {
        const val = json.daily.temperature_2m_mean[i];
        if (val === null) return;
        const month = new Date(dateStr + "T12:00:00").getMonth();
        monthTotals[month] += val;
        monthCounts[month]++;
    });

    return monthTotals.map((total, i) =>
        monthCounts[i] > 0 ? parseFloat((total / monthCounts[i]).toFixed(1)) : null
    );
}


function buildDayLabels() {
    return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
}

async function buildClimateChart(lat, lon) {
    const container = climateTrackerContainer.querySelector(".climateTrackerPanel");

    if (container) container.innerHTML = `
        <p class="climateTrackerTitle">Climate Tracker</p>
        <p class="climateTrackerSub">Loading historical data — this may take a moment...</p>
    `;

    const promises = ERAS.map(era =>
        fetchEraTemps(lat, lon, era.start, era.end)
            .then(temps => ({
                label: era.label,
                data: temps,
                borderColor: era.color,
                backgroundColor: "transparent",
                borderWidth: era.borderWidth,
                pointRadius: 0,
                tension: 0.3,
            }))
            .catch(e => {
                console.warn(`Skipping era ${era.label}:`, e);
                return null;
            })
    );

    const results = await Promise.all(promises);
    const datasets = results.filter(d => d !== null);

    if (container) container.innerHTML = `
        <div class="climateTrackerHeader">
            <div>
                <p class="climateTrackerTitle">Climate Tracker</p>
                <p class="climateTrackerSub">Monthly average temperature by era (°F)</p>
            </div>
            <button class="climateFullscreenBtn" title="Fullscreen">
                <i class="fa-solid fa-expand"></i>
            </button>
        </div>
        <canvas id="climateCanvas"></canvas>
    `;

    await new Promise(requestAnimationFrame);

    const canvas = document.getElementById("climateCanvas");
    if (!canvas) {
        console.error("Canvas not found!");
        return;
    }

    const ctx = canvas.getContext("2d");

    if (climateChart) {
        climateChart.destroy();
        climateChart = null;
    }

    climateChart = new Chart(ctx, {
        type: "line",
        data: { labels: buildDayLabels(), datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: "white",
                        font: { family: "DM Sans", size: 11 },
                        generateLabels: () => [
                            { text: "1940–1980", strokeStyle: "rgba(20, 60, 180, 0.9)", fillStyle: "rgba(20, 60, 180, 0.9)", lineWidth: 2, hidden: false },
                            { text: "1981–2000", strokeStyle: "rgba(70, 170, 230, 0.9)", fillStyle: "rgba(70, 170, 230, 0.9)", lineWidth: 2, hidden: false },
                            { text: "2001–2010", strokeStyle: "rgba(0, 200, 180, 0.9)",  fillStyle: "rgba(0, 200, 180, 0.9)",  lineWidth: 2, hidden: false },
                            { text: "2011–2020", strokeStyle: "rgba(75, 225, 20, 0.9)",  fillStyle: "rgba(75, 225, 20, 0.9)",  lineWidth: 2, hidden: false },
                            { text: "2021–2024", strokeStyle: "rgba(240, 210, 0, 1)",    fillStyle: "rgba(240, 210, 0, 1)",    lineWidth: 2, hidden: false },
                            { text: "2025",      strokeStyle: "rgb(255, 120, 0)",        fillStyle: "rgb(255, 120, 0)",        lineWidth: 3, hidden: false },
                            { text: "2026",      strokeStyle: "rgb(190, 0, 0)",          fillStyle: "rgb(190, 0, 0)",          lineWidth: 3, hidden: false },
                        ]
                    }
                },
                tooltip: {enabled: false, intersect: false }
            },
            scales: {
                x: {
                    ticks: { color: "rgba(255,255,255,0.7)", font: { size: 10 } },
                    grid:  { color: "rgba(255,255,255,0.08)" }
                },
                y: {
                    ticks: { color: "rgba(255,255,255,0.7)", font: { size: 10 },
                             callback: v => `${v}°F` },
                    grid:  { color: "rgba(255,255,255,0.08)" }
                }
            }
        }
    });

    setTimeout(() => climateChart.resize(), 300);

    const fullscreenBtn = document.querySelector(".climateFullscreenBtn");
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener("click", openClimateModal);
    }

    // now fetch and inject comparison box below header
    try {
        const todayAvg = await fetchTodayHistoricalAvg(lat, lon);
        window.climateTrackerTodayAvg = todayAvg;
        const comparisonHTML = buildTodayComparisonHTML(climateTrackerCurrentTemp, todayAvg);
        if (comparisonHTML) {
            const header = container.querySelector(".climateTrackerHeader");
            if (header) {
                header.insertAdjacentHTML("afterend", comparisonHTML);
            }
        }
    } catch (e) {
        console.warn("Could not fetch today's historical average:", e);
    }
}

function openClimateModal() {
    const modal = document.getElementById("climateModal");
    const modalCanvas = document.getElementById("climateModalCanvas");
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    // insert comparison box between header and canvas
    const existing = modal.querySelector(".climateTodayBox");
    if (!existing) {
        const box = document.createElement("div");
        box.innerHTML = buildTodayComparisonHTML(climateTrackerCurrentTemp, window.climateTrackerTodayAvg);
        if (box.firstElementChild) {
            modalCanvas.parentNode.insertBefore(box.firstElementChild, modalCanvas);
        }
    }

    // destroy old modal chart if exists
    if (window.climateModalChart) {
        window.climateModalChart.destroy();
        window.climateModalChart = null;
    }

    const ctx = modalCanvas.getContext("2d");
    window.climateModalChart = new Chart(ctx, {
        type: "line",
        data: climateChart.data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: "white",
                        font: { family: "DM Sans", size: 13 },
                        generateLabels: (chart) => {
                            const eraLabels = [
                                { text: "1940–1980", color: "rgba(20, 60, 180, 0.9)" },
                                { text: "1981–2000", color: "rgba(70, 170, 230, 0.9)" },
                                { text: "2001–2010", color: "rgba(0, 200, 180, 0.9)" },
                                { text: "2011–2020", color: "rgba(75, 225, 20, 0.9)" },
                                { text: "2021–2024", color: "rgba(240, 210, 0, 1)" },
                                { text: "2025",      color: "rgb(255, 120, 0, 1)" },
                                { text: "2026",      color: "rgba(220, 20, 20, 1)" },
                            ];
                            return eraLabels.map((era, i) => ({
                                text: era.text,
                                strokeStyle: era.color,
                                fillStyle: era.color,
                                lineWidth: 2,
                                hidden: false,
                                index: i,
                            }));
                        }
                    }
                },
                tooltip: { enabled: false, intersect: false }
            },
            scales: {
                x: {
                    ticks: { color: "rgba(255,255,255,0.7)", font: { size: 12 } },
                    grid:  { color: "rgba(255,255,255,0.08)" }
                },
                y: {
                    ticks: { color: "rgba(255,255,255,0.7)", font: { size: 12 },
                             callback: v => `${v}°F` },
                    grid:  { color: "rgba(255,255,255,0.08)" }
                }
            }
        }
    });
}
function closeClimateModal() {
    document.getElementById("climateModal").style.display = "none";
    document.body.style.overflow = "";
    if (window.climateModalChart) {
        window.climateModalChart.destroy();
        window.climateModalChart = null;
    }
}

async function fetchTodayHistoricalAvg(lat, lon) {
    const today = new Date();
    const currentYear = today.getFullYear();

    // build a 30 year average using a +/- 7 day window around today's date
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    const startDate = `${currentYear - 30}-01-01`;
    const endDate = `${currentYear - 1}-12-31`;

    const url =
        "https://archive-api.open-meteo.com/v1/archive" +
        `?latitude=${lat}&longitude=${lon}` +
        `&start_date=${startDate}&end_date=${endDate}` +
        "&daily=temperature_2m_mean" +
        "&temperature_unit=fahrenheit" +
        "&timezone=auto";

    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not fetch historical average");
    const json = await res.json();

    // only use dates within +/- 7 days of today's month/day across all years
    const todayMMDD = `${month}-${day}`;
    const target = new Date(`2000-${month}-${day}`); // reference year for comparison

    const vals = [];
    json.daily.time.forEach((dateStr, i) => {
        const val = json.daily.temperature_2m_mean[i];
        if (val === null) return;
        const parts = dateStr.split("-");
        const mmdd = `${parts[1]}-${parts[2]}`;
        const d = new Date(`2000-${mmdd}`);
        const diffDays = Math.abs((d - target) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) vals.push(val);
    });

    if (vals.length === 0) return null;
    return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
}

function buildTodayComparisonHTML(currentTemp, avgTemp) {
    if (currentTemp == null || avgTemp == null) return "";

    const today = new Date();
    const monthName = today.toLocaleDateString("en-US", { month: "short" });
    const day = today.getDate();
    const diff = parseFloat((currentTemp - avgTemp).toFixed(1));
    const sign = diff > 0 ? "+" : "";
    const diffText = `${sign}${diff}°F`;

    let diffColor = "rgba(255,255,255,0.8)";
    if (diff > 3) diffColor = "rgb(255, 120, 0)";
    else if (diff < -3) diffColor = "rgba(70, 170, 230, 0.9)";

    return `
        <div class="climateTodayBox">
            <span>Today: <strong>${currentTemp.toFixed(1)}°F</strong></span>
            <span class="climateDivider">|</span>
            <span>Avg for ${monthName} ${day}: <strong>${avgTemp}°F</strong></span>
            <span class="climateDivider">|</span>
            <span style="color: ${diffColor}"><strong>${diffText} ${diff > 0 ? "above" : "below"} normal</strong></span>
        </div>
    `;
}

function showClimateTrackerBtn(lat, lon, currentTemp) {
    climateTrackerLat = lat;
    climateTrackerLon = lon;
    climateTrackerCurrentTemp = currentTemp;
    climateChart = null;
    climateTrackerContainer.classList.remove("show");
    climateTrackerBtn.classList.remove("open");
    climateTrackerContainer.innerHTML = `<div class="climateTrackerPanel"></div>`;
    climateTrackerBtn.style.display = "flex";
}