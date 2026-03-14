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


cityInput.addEventListener("input", async () => {

    const query = cityInput.value;

    if(query.length < 2){
        suggestions.innerHTML = "";
        return;
    }

    const response = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${apiKey}`
    );

    const cities = await response.json();

    suggestions.innerHTML = "";

    cities.forEach(city => {

        if (cityInput.value.length > 0) {
            searchBox.classList.add("hasText");
        } else {
            searchBox.classList.remove("hasText");
        }

        const div = document.createElement("div");
        div.classList.add("suggestionItem");
        div.textContent = `${city.name}, ${city.state || ""} ${city.country}`;

        div.addEventListener("click", () => {
            cityInput.value = `${city.name}, ${city.state || ""} ${city.country}`;
            suggestions.innerHTML = "";
            cityInput.blur();

            getWeatherDataByCoords(city.lat, city.lon)
                .then(async (weatherData) => {
                    displayWeatherInfo(weatherData);
                    const lat = weatherData.coord.lat;
                    const lon = weatherData.coord.lon;
                    const forecastData = await getForecastData(lat, lon);
                    display7DayForecast(forecastData);
                    const hourlyData = await getHourlyForecastData(lat, lon);
                    displayHourlyForecast(hourlyData);
                })
                .catch(displayError);
        });

        suggestions.appendChild(div);
    });

});


clearBtn.addEventListener("click", () => {
    cityInput.value = "";
    searchBox.classList.remove("hasText"); 
    cityInput.focus();
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
        const weatherData = await getWeatherDataByCoords(lat, lon);
        displayWeatherInfo(weatherData);
        
        const forecastData = await getForecastData(lat, lon);
        display7DayForecast(forecastData);
        
        const hourlyData = await getHourlyForecastData(lat, lon);
        displayHourlyForecast(hourlyData);
        
    } 
    catch (error) {
        console.error("Geolocation Weather Error:", error);
        displayError("Could not fetch weather data for your location.");
    }
}

locationBtn.addEventListener("click", () => {
    // Check if browser supports geolocation
    if (!navigator.geolocation) {
        displayError("Geolocation is not supported by your browser.");
        return; 
    }
    navigator.geolocation.getCurrentPosition(showGeolocationWeather, handleGeolocationErrors);
});
// ----- END Functions for using current Geolocation -----


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
    const weatherData = await getWeatherDataByCoords(zipData.lat, zipData.lon);
    displayWeatherInfo(weatherData);
    const forecastData = await getForecastData(weatherData.coord.lat, weatherData.coord.lon);
    display7DayForecast(forecastData);
    const hourlyData = await getHourlyForecastData(weatherData.coord.lat, weatherData.coord.lon);
    displayHourlyForecast(hourlyData);
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
            const weatherData = await getWeatherDataByCoords(matches[0].lat, matches[0].lon);
            displayWeatherInfo(weatherData);
            const forecastData = await getForecastData(weatherData.coord.lat, weatherData.coord.lon);
            display7DayForecast(forecastData);
            const hourlyData = await getHourlyForecastData(weatherData.coord.lat, weatherData.coord.lon);
            displayHourlyForecast(hourlyData);
        } else {
            // show disambiguation list
            unique.forEach(match => {
                const div = document.createElement("div");
                div.classList.add("suggestionItem");
                div.textContent = `${match.name}, ${match.state || ""} ${match.country}`;
                div.addEventListener("click", () => {
                    cityInput.value = div.textContent;
                    suggestions.innerHTML = "";
                    getWeatherDataByCoords(match.lat, match.lon)
                        .then(weatherData => {
                            displayWeatherInfo(weatherData);
                            return getForecastData(weatherData.coord.lat, weatherData.coord.lon)
                                .then(display7DayForecast);
                        })
                        .catch(displayError);
                });
                suggestions.appendChild(div);
            });
        }
    } catch (error) {
        console.error(error);
        displayError(error);
    }
});


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
       weather: [{description, id}]} = data;

    const cityDisplay = document.createElement("h1");
    const tempDisplay = document.createElement("p");
    const weatherEmoji = document.createElement("p");

    cityDisplay.textContent = city;
    tempDisplay.textContent = `${temp.toFixed(1)}°F`;
    weatherEmoji.innerHTML = `
        <div class="emoji">${getWeatherEmoji(id)}</div>
        <div class="desc">${description}</div>
    `;

    tempDisplay.classList.add("tempDisplay");
    weatherEmoji.classList.add("weatherEmoji");

    
    card.textContent = "";
    card.style.display = "flex";
    card.style.flexDirection = "row";
    card.style.justifyContent = "space-between";
    card.style.alignItems = "center";

    setWeatherTheme(id);

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

function getWeatherEmoji(weatherId){
     
    switch(true){
        case (weatherId >= 200 && weatherId < 300):
            return "⛈️";   // thunderstorm

        case (weatherId >= 300 && weatherId < 400):
            return "🌦️";   // drizzle

        case (weatherId >= 500 && weatherId < 600):
            return "🌧️";   // rain

        case (weatherId >= 600 && weatherId < 700):
            return "❄️";   // snow

        case (weatherId >= 700 && weatherId < 800):
            return "🌫️";   // fog / atmosphere

        case (weatherId === 800):
            return "☀️";   // clear sky

        case (weatherId >= 801 && weatherId < 810):
            return "☁️";   // clouds

        default:
            return "❓";
    }
}

function setWeatherTheme(weatherId){

    if(weatherId >= 200 && weatherId < 600){
        card.style.background = "linear-gradient(#8aa2ff, #5b6ed6)"; // rain
    }
    else if(weatherId >= 600 && weatherId < 700){
        card.style.background = "linear-gradient(#e0f3ff, #b8d9ff)"; // snow
    }
    else if(weatherId === 800){
        card.style.background = "linear-gradient(#ffd76a, #ffb347)"; // sunny
    }
    else if(weatherId > 800){
        card.style.background = "linear-gradient(#d7d7d7, #a8a8a8)"; // cloudy
    }
}

function displayError(message){

    const errorDisplay = document.createElement("p");
    errorDisplay.textContent = message;
    errorDisplay.classList.add("errorDisplay");

    card.textContent = "";
    card.style.display = "flex";
    card.appendChild(errorDisplay);
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
"&hourly=temperature_2m,weathercode,precipitation_probability" +
"&temperature_unit=fahrenheit" +
"&timezone=auto" +
"&forecast_days=2";

const response = await fetch(apiUrl);
if (!response.ok) {
    throw new Error("Could not fetch hourly forecast data");
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

    for (let i = 0; i < 7; i++){
        const dayCard = document.createElement("div");
        dayCard.classList.add("forecastDay");

        const date = new Date(dates[i]);
        const dayName = date.toLocaleDateString("en-US", {weekday: "short"});

        const high = Math.round(highs[i]);
        const low = Math.round(lows[i]);

        const emoji = getForecastEmoji(codes[i]);

        dayCard.innerHTML = `
            <div class="forecastName">${dayName}</div>
            <div class="forecastEmoji">${emoji}</div>
            <div class="forecastTemps">${low}° / ${high}°</div>`;
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
        <div class="hourlyRain">Percipitation</div>
        <div class="hourlyTemp">Temp</div>
    `;
    hourlyList.appendChild(header);

    const times = hourlyData.hourly.time;
    const temps = hourlyData.hourly.temperature_2m;
    const codes = hourlyData.hourly.weathercode;
    const rain = hourlyData.hourly.precipitation_probability;

    // find the first hour past the current time
    const now = new Date();
    let startIndex = 0;

    for (let i = 0; i < times.length; i++){
        if (new Date(times[i]) >= now){
            startIndex = i;
            break;
        }
    }

    // show next 24 hours
    const endIndex = Math.min(startIndex + 24, times.length);

    for (let i = startIndex; i < endIndex; i++){
        const t = new Date(times[i]);
        const label = t.toLocaleTimeString("en-US", { hour: "numeric" });
        const rainPct = rain[i];

        const emoji = getForecastEmoji(codes[i]);

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

function getForecastEmoji(code){
    if (code === 0) return "☀️"; 
    if (code === 1 || code === 2) return "🌤️";
    if (code === 3) return "☁️";
    if (code === 45 || code === 48) return "🌫️";
    if (code === 51 || code === 53 || code === 55) return "🌦️";
    if (code === 56 || code === 57) return "🌧️";
    if (code === 61 || code === 63 || code === 65) return "🌧️";
    if (code === 66 || code === 67) return "🌧️";
    if(code === 71 || code === 73 || code === 75) return "❄️";
    if (code === 77) return "🌨️";
    if (code === 80 || code === 81 || code === 82) return "🌧️";
    if (code === 85 || code === 86) return "❄️";
    if (code === 95 || code === 96 || code === 99) return "⛈️";
        return "❓";
};