const form = document.querySelector("#weather-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const listenButton = document.querySelector("#listen-button");
const messageArea = document.querySelector("#message-area");
const statusMessage = document.querySelector("#status-message");
const messageAudioButton = document.querySelector("#message-audio-button");
const weatherPanel = document.querySelector("#weather-panel");
const cityFacts = document.querySelector("#city-facts");
const factIcon = document.querySelector("#fact-icon");
const factCity = document.querySelector("#fact-city");
const factCurrentIcon = document.querySelector("#fact-current-icon");
const factCurrent = document.querySelector("#fact-current");
const factOutlookIcon = document.querySelector("#fact-outlook-icon");
const factOutlook = document.querySelector("#fact-outlook");
const factHistoryIcon = document.querySelector("#fact-history-icon");
const factHistory = document.querySelector("#fact-history");
const cityFactContent = document.querySelector(".city-fact-content");
const locationName = document.querySelector("#location-name");
const localTime = document.querySelector("#local-time");
const weatherIcon = document.querySelector("#weather-icon");
const currentTemperature = document.querySelector("#current-temperature");
const currentCondition = document.querySelector("#current-condition");
const weatherReport = document.querySelector("#weather-report");
const weatherDetails = document.querySelector("#weather-details");
const speakButton = document.querySelector("#speak-button");
const backgroundSlides = Array.from(document.querySelectorAll(".background-slide"));
const backgroundImages = Array.from(
  { length: 5 },
  (_, index) => `/backgrounds/Weather_bot_${index}.jpg`,
);

let latestReport = "";
let latestWeather = null;
let latestMessage = "";
let recognition = null;
let reportAudio = null;
let reportAudioUrl = null;
const cityWeatherFacts = [
  {
    city: "Singapore",
    icon: "🌦️",
    currentIcon: "🌡️",
    current: "Typically warm and humid throughout the year. Cloud cover and showers are common parts of the local climate.",
    outlookIcon: "🌦️",
    outlook: "Rain can occur in any season, often alongside sunny intervals. This describes usual climate patterns, not today's forecast.",
    historyIcon: "📚",
    history: "Singapore's equatorial climate stays tropical year-round, with rainfall in every season and only modest seasonal temperature changes.",
  },
  {
    city: "Cairo",
    icon: "☀️",
    currentIcon: "🌤️",
    current: "Typically very dry, with abundant sunshine and low humidity. Rainfall is limited compared with many other large cities.",
    outlookIcon: "🔥",
    outlook: "Summer is usually much hotter than winter, while cooler conditions are more common in winter. This is seasonal context, not a forecast.",
    historyIcon: "📚",
    history: "Cairo's desert climate is defined by very low rainfall across the year and long, hot summers.",
  },
  {
    city: "Reykjavik",
    icon: "🌬️",
    currentIcon: "🌥️",
    current: "Often cool and breezy, with cloud cover that can change quickly. Coastal weather is strongly influenced by the surrounding ocean.",
    outlookIcon: "🌦️",
    outlook: "Conditions vary through the seasons, and wind or passing showers are part of the local climate. This is not a day-specific forecast.",
    historyIcon: "📚",
    history: "Reykjavik's maritime climate is shaped by the North Atlantic, bringing frequent winds and less extreme temperature swings than inland areas.",
  },
  {
    city: "Mumbai",
    icon: "🌧️",
    currentIcon: "💧",
    current: "Typically warm, with humidity rising during the rainy season. Conditions can feel noticeably different between wet and dry parts of the year.",
    outlookIcon: "🌧️",
    outlook: "The summer monsoon is the main rainy period, though its arrival and rainfall totals vary from year to year. This is climate context, not a forecast.",
    historyIcon: "📚",
    history: "A large share of Mumbai's yearly rainfall usually comes during monsoon months, making seasonal rainfall a defining part of its climate.",
  },
  {
    city: "London",
    icon: "🌦️",
    currentIcon: "🌤️",
    current: "Often mild, with a changing mix of cloud, sunshine, and passing rain. Conditions can shift over the course of a day.",
    outlookIcon: "🌦️",
    outlook: "Showers are possible in any season, with temperatures and daylight changing through the year. This describes climate, not an upcoming forecast.",
    historyIcon: "📚",
    history: "London's maritime climate brings changeable conditions throughout the year, with generally milder winters than many inland places at similar latitudes.",
  },
];

function startCityFactRotation() {
  if (
    !cityFacts ||
    !factIcon ||
    !factCity ||
    !factCurrentIcon ||
    !factCurrent ||
    !factOutlookIcon ||
    !factOutlook ||
    !factHistoryIcon ||
    !factHistory ||
    !cityFactContent
  ) return;

  let activeFact = 0;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  window.setInterval(() => {
    if (cityFacts.hidden) return;
    cityFacts.classList.add("is-changing");
    window.setTimeout(() => {
      activeFact = (activeFact + 1) % cityWeatherFacts.length;
      const fact = cityWeatherFacts[activeFact];
      factIcon.textContent = fact.icon;
      factCity.textContent = fact.city;
      factCurrentIcon.textContent = fact.currentIcon;
      factCurrent.textContent = fact.current;
      factOutlookIcon.textContent = fact.outlookIcon;
      factOutlook.textContent = fact.outlook;
      factHistoryIcon.textContent = fact.historyIcon;
      factHistory.textContent = fact.history;
      cityFacts.classList.remove("is-changing");
    }, 450);
  }, 5200);
}

function startBackgroundSlideshow() {
  if (backgroundSlides.length !== 2) return;

  const imageCache = backgroundImages.map((source) => {
    const image = new Image();
    image.src = source;
    return image;
  });
  let activeLayer = 0;
  let activeImage = 0;

  const changeBackground = () => {
    const nextImage = (activeImage + 1) % imageCache.length;
    const nextLayer = 1 - activeLayer;
    backgroundSlides[nextLayer].style.backgroundImage =
      `url("${backgroundImages[nextImage]}")`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backgroundSlides[nextLayer].classList.add("background-slide-active");
        backgroundSlides[activeLayer].classList.remove("background-slide-active");
        activeLayer = nextLayer;
        activeImage = nextImage;
      });
    });
  };

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.setInterval(changeBackground, 2400);
  }
}

startBackgroundSlideshow();
startCityFactRotation();

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listenButton.disabled = true;
    listenButton.classList.add("listening");
    showStatus("Listening… say a city name.", "loading");
  };

  recognition.onresult = (event) => {
    const city = event.results[0][0].transcript.trim();
    if (!city) {
      showStatus("I didn’t catch a city name. Please try again.", "error");
      return;
    }

    cityInput.value = city;
    showStatus(`I heard “${city}”. Checking the weather…`, "loading");
    form.requestSubmit();
  };

  recognition.onerror = (event) => {
    const messages = {
      "not-allowed": "Microphone access is blocked. Allow it in your browser settings.",
      "service-not-allowed": "Speech recognition is unavailable in this browser.",
      "no-speech": "I didn’t hear anything. Please try speaking again.",
      network: "Speech recognition needs an internet connection.",
    };
    if (event.error !== "aborted") {
      const message = messages[event.error] || "Speech recognition failed. Please try again.";
      showResponse(message, "error");
      void playResponseVoice(message);
    }
  };

  recognition.onend = () => {
    listenButton.disabled = false;
    listenButton.classList.remove("listening");
  };
} else {
  listenButton.disabled = true;
  listenButton.title = "Speech input is not supported in this browser";
  listenButton.setAttribute("aria-label", "Speech input is not supported in this browser");
}

function showStatus(message, state = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${state}`.trim();
}

function showResponse(message, state = "") {
  stopCurrentSpeech();
  latestMessage = message;
  messageArea.classList.add("is-response");
  messageAudioButton.hidden = false;
  messageAudioButton.disabled = false;
  messageAudioButton.textContent = "Hear message";
  cityFacts.hidden = true;
  weatherPanel.hidden = true;
  showStatus(message, state);
}

function stopCurrentSpeech() {
  if (reportAudio) {
    reportAudio.pause();
    reportAudio = null;
  }
  if (reportAudioUrl) {
    URL.revokeObjectURL(reportAudioUrl);
    reportAudioUrl = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (messageAudioButton) {
    messageAudioButton.disabled = false;
    messageAudioButton.textContent = "Hear message";
  }
}

async function playResponseVoice(message) {
  let audio = reportAudio;
  if (!audio) {
    messageAudioButton.disabled = true;
    messageAudioButton.textContent = "Preparing Astra’s voice…";
    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Could not create speech.");
      }

      reportAudioUrl = URL.createObjectURL(await response.blob());
      reportAudio = new Audio(reportAudioUrl);
      audio = reportAudio;
      const audioUrl = reportAudioUrl;
      const resetAudio = () => {
        if (reportAudio !== audio) return;
        URL.revokeObjectURL(audioUrl);
        reportAudio = null;
        reportAudioUrl = null;
        messageAudioButton.disabled = false;
        messageAudioButton.textContent = "Try voice again";
      };
      audio.addEventListener("ended", resetAudio, { once: true });
      audio.addEventListener("error", () => {
        resetAudio();
        showStatus(
          `${message} Astra’s voice could not be played. Select “Try voice again” to retry.`,
          "error",
        );
      }, { once: true });
    } catch (error) {
      messageAudioButton.disabled = false;
      messageAudioButton.textContent = "Try voice again";
      const reason = error instanceof Error ? error.message : "Unknown speech error.";
      showStatus(
        `${message} Astra’s voice could not be prepared: ${reason} Select “Try voice again” to retry.`,
        "error",
      );
      return;
    }
  }

  try {
    await audio.play();
    messageAudioButton.disabled = false;
    messageAudioButton.textContent = "Speaking…";
    showStatus(message);
  } catch {
    messageAudioButton.disabled = false;
    messageAudioButton.textContent = reportAudio === audio
      ? "Play with Astra’s voice"
      : "Try voice again";
    showStatus(
      `${message} Audio playback was blocked. Select “${messageAudioButton.textContent}” to hear Astra’s voice.`,
      "error",
    );
    if (reportAudio !== audio && reportAudioUrl) {
      URL.revokeObjectURL(reportAudioUrl);
      reportAudioUrl = null;
    }
  }
}

function formatTemperature(value) {
  return value == null ? "—" : `${Math.round(value)}°`;
}

function addDetail(label, value) {
  const item = document.createElement("div");
  item.className = "detail-item";

  const title = document.createElement("p");
  title.className = "detail-label";
  title.textContent = label;

  const reading = document.createElement("p");
  reading.className = "detail-value";
  reading.textContent = value;

  item.append(title, reading);
  weatherDetails.append(item);
}

function iconForCondition(condition) {
  if (/thunder|storm/i.test(condition)) return "ϟ";
  if (/snow|sleet/i.test(condition)) return "❄";
  if (/rain|drizzle|shower/i.test(condition)) return "☂";
  if (/fog/i.test(condition)) return "≋";
  if (/cloud|overcast/i.test(condition)) return "☁";
  return "☀";
}

function renderWeather(weather, report) {
  if (reportAudio) {
    reportAudio.pause();
    reportAudio = null;
  }
  if (reportAudioUrl) {
    URL.revokeObjectURL(reportAudioUrl);
    reportAudioUrl = null;
  }

  locationName.textContent = weather.location;
  localTime.textContent = weather.local_time
    ? `${weather.period === "tomorrow" ? "Forecast" : "Local time"} · ${weather.period_date || weather.local_time.replace("T", " ")}`
    : "Current local conditions";
  weatherIcon.textContent = iconForCondition(weather.condition);
  currentTemperature.textContent = formatTemperature(weather.temperature_c);
  currentCondition.textContent = weather.condition;
  weatherReport.textContent = report;
  latestReport = report;
  latestWeather = weather;

  weatherDetails.replaceChildren();
  const periodLabel = weather.period === "tomorrow" ? "Tomorrow" : "Today";
  document.querySelector(".details-heading h2").textContent = `${periodLabel}, at a glance`;
  addDetail("🌡️ Feels like", formatTemperature(weather.feels_like_c));
  addDetail(`🔺 ${periodLabel}’s high`, formatTemperature(weather.today_high_c));
  addDetail(`🔻 ${periodLabel}’s low`, formatTemperature(weather.today_low_c));
  addDetail(
    "💨 Wind",
    weather.wind_kmh == null ? "—" : `${Math.round(weather.wind_kmh)} km/h`,
  );
  addDetail(
    "💧 Humidity",
    weather.humidity_percent == null ? "—" : `${weather.humidity_percent}%`,
  );
  addDetail(
    "🌧️ Precipitation",
    weather.precipitation_mm == null ? "—" : `${weather.precipitation_mm} mm`,
  );
  addDetail(
    "☔ Rain chance",
    weather.precipitation_probability_percent == null
      ? "—"
      : `${weather.precipitation_probability_percent}%`,
  );
  if (weather.rainy_season) {
    addDetail(
      "🌿 Typical wet season",
      weather.rainy_season.is_typically_wet_month ? "Usually yes" : "Usually no",
    );
  }

  weatherPanel.hidden = false;
  cityFacts.hidden = true;
  speakButton.disabled = false;
}

listenButton.addEventListener("click", () => {
  if (!recognition) return;
  try {
    recognition.start();
  } catch (error) {
    const message = error.name === "InvalidStateError"
      ? "Speech recognition is already listening."
      : "Could not start speech recognition. Please try again.";
    showStatus(message, error.name === "InvalidStateError" ? "loading" : "error");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = cityInput.value.trim();
  if (!city) {
    cityInput.focus();
    return;
  }

  searchButton.disabled = true;
  searchButton.querySelector("span").textContent = "Checking…";
  stopCurrentSpeech();
  latestMessage = "";
  messageArea.classList.remove("is-response");
  messageAudioButton.hidden = true;
  weatherPanel.hidden = true;
  cityFacts.hidden = false;
  showStatus("Finding the latest conditions…", "loading");

  try {
    const response = await fetch("/api/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: city }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Could not load weather. Please try again.");
    }

    if (data.type === "greeting") {
      showResponse(data.message);
      void playResponseVoice(data.message);
      return;
    }

    renderWeather(data.weather, data.report);
    showStatus("Here’s a little clarity for your day. Astra is preparing your spoken report…");
    void speakWeatherReport(true);
  } catch (error) {
    const message = error.message || "Something went wrong. Please try again.";
    showResponse(message, "error");
    void playResponseVoice(message);
  } finally {
    searchButton.disabled = false;
    searchButton.querySelector("span").textContent = "Find weather";
  }
});

messageAudioButton.addEventListener("click", () => {
  if (latestMessage) void playResponseVoice(latestMessage);
});

speakButton.addEventListener("click", () => {
  void speakWeatherReport();
});

function greetingForWeather(weather) {
  const localHour = Number(weather.local_time?.match(/T(\d{2}):/)?.[1]);
  const hour = Number.isFinite(localHour) ? localHour : new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

function speakInBrowser(text) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = navigator.language || "en-US";
  utterance.onstart = () => {
    speakButton.querySelector("span").textContent = "Speaking…";
    showStatus("Astra is speaking your weather report.", "loading");
  };
  utterance.onend = () => {
    speakButton.disabled = false;
    speakButton.querySelector("span").textContent = "Listen to report";
  };
  utterance.onerror = (event) => {
    speakButton.disabled = false;
    speakButton.querySelector("span").textContent = "Listen to report";
    if (event.error !== "canceled" && event.error !== "interrupted") {
      showStatus("Your browser could not play Astra’s voice. Try “Listen to report” again.", "error");
    }
  };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

async function speakWeatherReport(automatic = false) {
  if (!latestReport || !latestWeather) {
    showStatus("There is no weather report to read aloud yet.", "error");
    return;
  }

  const cityName = latestWeather.location.split(",")[0].trim();
  const spokenReport =
    `${greetingForWeather(latestWeather)}, I am your AI assistant Astra. ` +
    `The weather report for ${cityName} is: ${latestReport} Enjoy, have a great time.`;

  speakButton.disabled = true;
  speakButton.querySelector("span").textContent = "Preparing voice…";
  if (!automatic) showStatus("Astra is preparing your weather report…", "loading");

  try {
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: spokenReport }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Could not create speech. Please try again.");
    }

    if (reportAudio) {
      reportAudio.pause();
      URL.revokeObjectURL(reportAudioUrl);
    }
    reportAudioUrl = URL.createObjectURL(await response.blob());
    reportAudio = new Audio(reportAudioUrl);
    reportAudio.addEventListener("ended", () => {
      URL.revokeObjectURL(reportAudioUrl);
      reportAudioUrl = null;
      reportAudio = null;
      speakButton.disabled = false;
      speakButton.querySelector("span").textContent = "Listen to report";
    }, { once: true });
    await reportAudio.play();
    speakButton.querySelector("span").textContent = "Speaking…";
    showStatus("Astra is speaking your weather report.", "loading");
  } catch (error) {
    const message = error.message || "Could not play the weather report.";
    if (speakInBrowser(spokenReport)) {
      showStatus("Using your browser’s voice for Astra’s report.", "loading");
      return;
    }
    showStatus(
      automatic
        ? `Weather report loaded, but Astra’s voice could not start: ${message} Use “Listen to report” to try again.`
        : message,
      "error",
    );
    speakButton.disabled = false;
    speakButton.querySelector("span").textContent = "Listen to report";
    if (reportAudioUrl) {
      URL.revokeObjectURL(reportAudioUrl);
      reportAudioUrl = null;
    }
    reportAudio = null;
  }
}
