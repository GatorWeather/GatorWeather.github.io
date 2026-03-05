const weatherForm = document.querySelector(".weatherForm");
const cityInput = document.querySelector(".cityInput");
const card = document.querySelector(".card");
const apiKey = "8e2d81f77bf781eee278d91811303875";

weatherForm.addEventListener("submit", async event => {

    event.preventDefault();

    const city = cityInput.value;

    if (city){
        try {
            const weatherData = await getWeatherData(city);
            displayWeatherInfo(weatherData);  
        }
        catch (error){
            console.error(error);
            displayError(error);
        }
    }
    else {
        displayError("Please enter a city");
    }

});

async function getWeatherData(city){

    //Edit this api call here to get different data
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=imperial&appid=${apiKey}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error("Could not fetch weather data");
    }
    return await response.json();
}

function displayWeatherInfo(data){
    
    const {name: city, 
       main: {temp, humidity, pressure},
       wind: {speed},
       weather: [{description, id}]} = data;
    
    card.textContent = "";
    card.style.display = "flex";

    // for dynamic background
    setWeatherTheme(id);

    const cityDisplay = document.createElement("h1");
    const tempDisplay = document.createElement("p");
    const descriptionDisplay = document.createElement("p");
    const weatherEmoji = document.createElement("p");        

    cityDisplay.textContent = city;
    tempDisplay.textContent = `${temp.toFixed(1)}°F`;
    weatherEmoji.innerHTML = `
    <div class="emoji">${getWeatherEmoji(id)}</div>
    <div class="desc">${description}</div>
`;
    

    tempDisplay.classList.add("tempDisplay");
    weatherEmoji.classList.add("weatherEmoji");

    card.appendChild(cityDisplay);
    card.appendChild(tempDisplay);
    

    // grid container
    const list = document.createElement("ul");

    const humidityItem = document.createElement("li");
    humidityItem.innerHTML = `
        <i class="fa-solid fa-droplet"></i>
        Humidity: ${humidity}%
    `;

    const pressureItem = document.createElement("li");
    pressureItem.innerHTML = `
        <i class="fa-solid fa-gauge"></i>
        Pressure: ${pressure}
    `;

    const windItem = document.createElement("li");
    windItem.innerHTML = `
    <i class="fa-solid fa-wind"></i>
    Wind: ${speed} mph
    `;

    
    list.appendChild(humidityItem); 
    list.appendChild(pressureItem); 
    list.appendChild(windItem);
    card.appendChild(cityDisplay);
    card.appendChild(tempDisplay);
    card.appendChild(weatherEmoji);
    card.appendChild(cityDisplay);
    card.appendChild(list);
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
