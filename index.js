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

function displayWeatherInfo(data){
    
    const {name: city, 
        main: {temp, feels_like, humidity, pressure},
        wind: {speed},
        weather: [{description, id}],
        sys: {sunrise, sunset}
     } = data;

    const cityDisplay = document.createElement("h1");
    const tempDisplay = document.createElement("p");
    const weatherEmoji = document.createElement("p");

    cityDisplay.textContent = city;
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
    rightSide.style.textAlign = "right";
    rightSide.appendChild(cityDisplay);

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

async function getForecastData(lat, lon){
    // one call 7 day for case using condinates. 
    const apiUrl = 
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + lat +
    "&longitude=" + lon +
    "&daily=weathercode,temperature_2m_max,temperature_2m_min" +
    "&temperature_unit=fahrenheit" +
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
"&hourly=temperature_2m,weathercode,precipitation_probability,is_day" +
"&temperature_unit=fahrenheit" +
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

    const hiLoLabel = document.createElement("div");
    hiLoLabel.textContent = "Low / High";
    hiLoLabel.classList.add("hiLoLabel");

    header.appendChild(forecastLabel);
    header.appendChild(hiLoLabel);
    
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

        const emoji = getForecastEmoji(codes[i], true);

        dayCard.innerHTML = `
            <div class="forecastName">${dayName}</div>
            <div class="forecastEmoji">${emoji}</div>
            <div class="forecastTemps">${low}° / ${high}°</div>
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
    header.innerHTML = `
        <div class="hourlyTime">Time</div>
        <div class="hourlyEmoji">Forecast</div>
        <div class="hourlyRain">Precipitation</div>
        <div class="hourlyTemp">Temp</div>
    `;
    hourlyList.appendChild(header);

    const times = hourlyData.hourly.time;
    const temps = hourlyData.hourly.temperature_2m;
    const codes = hourlyData.hourly.weathercode;
    const rain = hourlyData.hourly.precipitation_probability;
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
        const rainPct = rain[i];
    
        const emoji = getForecastEmoji(codes[i], isDayArr[i] === 1);

        const item = document.createElement("div");
        item.classList.add("hourlyItem");
        item.innerHTML = `  
            <div class="hourlyTime">${label}</div>
            <div class="hourlyEmoji">${emoji}</div>
            <div class="hourlyRain">${rainPct}%</div>
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
    const [weatherData, forecastData, hourlyData, healthData] = await Promise.all([
        getWeatherDataByCoords(lat, lon),
        getForecastData(lat, lon),
        getHourlyForecastData(lat, lon),
        getHealthIndicatorData(lat, lon).catch(error => {
            console.error("Health indicator fetch failed:", error);
            return null;
         })
    ]);

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
    
    displayWeatherInfo(weatherData);
    display7DayForecast(forecastData);
    displayHourlyForecast(hourlyData);
    displayHealthIndicators(healthData);
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