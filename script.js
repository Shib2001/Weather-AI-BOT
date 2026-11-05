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
let latestMessageIsGreeting = false;
let recognition = null;
let reportAudio = null;
let reportAudioUrl = null;
let welcomeAudio = null;
let welcomeAudioUrl = null;
let welcomeAudioCleanup = null;
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

function startWelcomeVoice() {
  const sessionKey = "weatherly-welcome-played-v1";
  try {
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "true");
  } catch (error) {
    console.warn("Could not save the welcome-voice session marker.", error);
  }

  const welcomeText =
    "Hey there, welcome to your personal weather forecast AI assistant, Weatherly. " +
    "I’m your weather reporter, Astra. Let me know if you want to know the weather in your country.";
  welcomeAudio = new Audio();
  welcomeAudio.preload = "auto";
  let hasPlayed = false;

  const removeGestureListeners = () => {
    document.removeEventListener("pointerdown", playAfterGesture);
    document.removeEventListener("keydown", playAfterGesture);
  };
  const releaseAudio = () => {
    removeGestureListeners();
    if (welcomeAudioUrl) {
      URL.revokeObjectURL(welcomeAudioUrl);
      welcomeAudioUrl = null;
    }
    welcomeAudioCleanup = null;
  };
  const playAfterGesture = () => {
    if (!welcomeAudio.src || hasPlayed) return;
    void welcomeAudio.play().then(() => {
      hasPlayed = true;
      removeGestureListeners();
    }).catch(() => {});
  };

  document.addEventListener("pointerdown", playAfterGesture);
  document.addEventListener("keydown", playAfterGesture);
  welcomeAudioCleanup = releaseAudio;
  welcomeAudio.addEventListener("ended", releaseAudio, { once: true });
  welcomeAudio.addEventListener("error", () => {
    console.warn("The welcome voice audio could not be played.");
    releaseAudio();
  }, { once: true });

  void fetch("/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: welcomeText }),
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Could not prepare the welcome voice.");
    }
    welcomeAudioUrl = URL.createObjectURL(await response.blob());
    welcomeAudio.src = welcomeAudioUrl;
    welcomeAudio.load();
    playAfterGesture();
  }).catch((error) => {
    console.warn("The welcome voice could not be prepared.", error);
    releaseAudio();
  });
}

startBackgroundSlideshow();
startCityFactRotation();
startWelcomeVoice();

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

function greetingResponseFor(query) {
  const nameMatch = query.match(
    /\b(?:my name is|i am|i['’]m|call me)\s+([A-Za-z][A-Za-z'-]{0,30})\b/i,
  );
  const name = nameMatch?.[1].replace(/['-]+$/, "") || "";
  const greetingText = nameMatch
    ? `${query.slice(0, nameMatch.index)} ${query.slice(nameMatch.index + nameMatch[0].length)}`
    : query;
  const normalized = greetingText
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(?:and|please)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const isGreeting =
    /^(?:(?:hello|hi|hey)(?: there)?|good (?:morning|afternoon|evening)|(?:morning|afternoon|evening)|how are you(?: doing)?|how is it going|how s it going)(?:\s+good (?:morning|afternoon|evening))?(?:\s+(?:how are you(?: doing)?|how is it going|how s it going))?$/.test(normalized);

  if (!isGreeting) return null;

  const timeGreeting = normalized.match(/\b(?:good )?(morning|afternoon|evening)\b/);
  const timePhrase = timeGreeting ? ` good ${timeGreeting[1]}` : "";
  if (name) {
    const displayName = `${name[0].toUpperCase()}${name.slice(1)}`;
    return `Hey${timePhrase}! How are you? I’m Astra, your weather assistant. How are you, ${displayName}?`;
  }
  if (normalized.startsWith("how are you")) {
    return "I’m doing well, thank you for asking! I’m Astra, your weather assistant. What city can I help you with?";
  }
  return `Hey${timePhrase}! How are you? I’m Astra, your weather assistant. What city’s weather can I help you with?`;
}

function showResponse(message, state = "") {
  stopCurrentSpeech();
  latestMessage = message;
  latestMessageIsGreeting = false;
  messageArea.classList.add("is-response");
  messageArea.classList.remove("is-greeting");
  messageAudioButton.hidden = false;
  messageAudioButton.disabled = false;
  messageAudioButton.textContent = "Hear message";
  cityFacts.hidden = true;
  weatherPanel.hidden = true;
  showStatus(message, state);
}

function showGreetingResponse(message) {
  stopCurrentSpeech();
  latestMessage = message;
  latestMessageIsGreeting = true;
  messageArea.classList.remove("is-response");
  messageArea.classList.add("is-greeting");
  messageAudioButton.hidden = false;
  messageAudioButton.disabled = false;
  messageAudioButton.textContent = "Hear greeting";
  cityFacts.hidden = false;
  weatherPanel.hidden = true;
  showStatus("");
}

function showGreetingVoiceError(message) {
  messageArea.classList.remove("is-greeting");
  messageArea.classList.remove("is-response");
  cityFacts.hidden = false;
  weatherPanel.hidden = true;
  showStatus(message, "error");
}

function stopWelcomeVoice() {
  if (welcomeAudioCleanup) welcomeAudioCleanup();
  if (welcomeAudio) {
    welcomeAudio.pause();
    welcomeAudio = null;
  }
  if (welcomeAudioUrl) {
    URL.revokeObjectURL(welcomeAudioUrl);
    welcomeAudioUrl = null;
  }
}

function stopCurrentSpeech(stopWelcome = true) {
  if (stopWelcome) stopWelcomeVoice();
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

async function playResponseVoice(message, isGreeting = false) {
  const retryLabel = isGreeting ? "Hear greeting" : "Hear message";
  let audio = reportAudio;
  if (!audio) {
    messageAudioButton.disabled = true;
    messageAudioButton.textContent = isGreeting
      ? "Preparing greeting voice…"
      : "Preparing Astra’s voice…";
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
        messageAudioButton.textContent = retryLabel;
      };
      audio.addEventListener("ended", resetAudio, { once: true });
      audio.addEventListener("error", () => {
        resetAudio();
        const voiceError = isGreeting
          ? "Astra’s greeting voice could not be played. Select “Try greeting again” to retry."
          : `${message} Astra’s voice could not be played. Select “Try voice again” to retry.`;
        if (isGreeting) showGreetingVoiceError(voiceError);
        else showStatus(voiceError, "error");
      }, { once: true });
    } catch (error) {
      messageAudioButton.disabled = false;
      messageAudioButton.textContent = isGreeting ? "Try greeting again" : "Try voice again";
      const reason = error instanceof Error ? error.message : "Unknown speech error.";
      const voiceError = isGreeting
        ? `Astra’s greeting voice could not be prepared: ${reason} Select “Try greeting again” to retry.`
        : `${message} Astra’s voice could not be prepared: ${reason} Select “Try voice again” to retry.`;
      if (isGreeting) showGreetingVoiceError(voiceError);
      else showStatus(voiceError, "error");
      return;
    }
  }

  try {
    messageAudioButton.disabled = false;
    messageAudioButton.textContent = isGreeting ? "Play greeting" : "Play with Astra’s voice";
    if (!isGreeting) showStatus(message);
    await audio.play();
    messageAudioButton.textContent = isGreeting ? "Playing greeting…" : "Speaking…";
  } catch {
    messageAudioButton.disabled = false;
    messageAudioButton.textContent = reportAudio === audio
      ? isGreeting ? "Play greeting" : "Play with Astra’s voice"
      : isGreeting ? "Try greeting again" : "Try voice again";
    const playbackError = isGreeting
      ? `Audio playback was blocked. Select “${messageAudioButton.textContent}” to hear Astra’s greeting.`
      : `${message} Audio playback was blocked. Select “${messageAudioButton.textContent}” to hear Astra’s voice.`;
    if (isGreeting) showGreetingVoiceError(playbackError);
    else showStatus(playbackError, "error");
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
  const periodLabels = {
    day_before_yesterday: "The day before yesterday",
    yesterday: "Historical weather",
    today: "Local time",
    tomorrow: "Forecast",
    day_after_tomorrow: "Forecast",
  };
  localTime.textContent =
    `${periodLabels[weather.period] || "Local time"} · ` +
    `${weather.period_date || weather.local_time?.replace("T", " ") || ""}`;
  weatherIcon.textContent = iconForCondition(weather.condition);
  currentTemperature.textContent = formatTemperature(weather.temperature_c);
  currentCondition.textContent = weather.condition;
  weatherReport.textContent = report;
  latestReport = report;
  latestWeather = weather;

  weatherDetails.replaceChildren();
  const periodLabelsForCards = {
    day_before_yesterday: "The day before yesterday",
    yesterday: "Yesterday",
    today: "Today",
    tomorrow: "Tomorrow",
    day_after_tomorrow: "The day after tomorrow",
  };
  const periodLabel = periodLabelsForCards[weather.period] || "Today";
  document.querySelector(".details-heading h2").textContent = `${periodLabel}, at a glance`;
  document.querySelector("#period-badge").textContent = periodLabel.toUpperCase();
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
  stopCurrentSpeech(false);
  latestMessage = "";
  latestMessageIsGreeting = false;
  messageArea.classList.remove("is-response");
  messageArea.classList.remove("is-greeting");
  messageAudioButton.hidden = true;
  weatherPanel.hidden = true;
  cityFacts.hidden = false;
  showStatus("Finding the latest conditions…", "loading");

  try {
    const greeting = greetingResponseFor(city);
    if (greeting) {
      let greetingMessage = greeting;
      try {
        const response = await fetch("/api/greeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: city }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Could not load the greeting.");
        }
        greetingMessage = data.message || greeting;
      } catch (error) {
        console.warn("Could not load the cached greeting; using the local greeting.", error);
      }
      showGreetingResponse(greetingMessage);
      void playResponseVoice(greetingMessage, true);
      return;
    }

    const response = await fetch("/api/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: city }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Could not load weather. Please try again.");
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
  if (latestMessage) {
    void playResponseVoice(latestMessage, latestMessageIsGreeting);
  }
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

function spokenWeatherDetails(weather) {
  const details = [];
  const temperature = (value) => `${Math.round(value)} degrees Celsius`;

  if (weather.feels_like_c != null) {
    details.push(`It feels like ${temperature(weather.feels_like_c)}`);
  }
  if (weather.today_high_c != null) {
    details.push(`The high could reach ${temperature(weather.today_high_c)}`);
  }
  if (weather.today_low_c != null) {
    details.push(`The low could drop to ${temperature(weather.today_low_c)}`);
  }
  if (weather.wind_kmh != null) {
    details.push(`Winds are around ${Math.round(weather.wind_kmh)} kilometers per hour`);
  }
  if (weather.humidity_percent != null) {
    details.push(`Humidity is ${Math.round(weather.humidity_percent)} percent`);
  }
  if (weather.precipitation_mm != null) {
    details.push(`Precipitation is expected to be ${weather.precipitation_mm} millimeters`);
  }
  if (weather.precipitation_probability_percent != null) {
    details.push(`The chance of rain is ${Math.round(weather.precipitation_probability_percent)} percent`);
  }

  if (details.length === 0) return "";
  const firstDetail = `${details[0][0].toLowerCase()}${details[0].slice(1)}`;
  const remainingDetails = details.slice(1).join(". ");
  return `Also, in ${weather.location.split(",")[0].trim()}, ${firstDetail}.` +
    `${remainingDetails ? ` ${remainingDetails}.` : ""}`;
}

async function speakWeatherReport(automatic = false) {
  if (!latestReport || !latestWeather) {
    showStatus("There is no weather report to read aloud yet.", "error");
    return;
  }
  stopWelcomeVoice();

  const cityName = latestWeather.location.split(",")[0].trim();
  const spokenDetails = spokenWeatherDetails(latestWeather);
  const reportText = latestReport.trim().replace(/[.!?]+$/, "");
  const spokenReport =
    `${greetingForWeather(latestWeather)}, I am your AI assistant Astra. ` +
    `The weather report for ${cityName} is: ${reportText}.` +
    `${spokenDetails ? ` ${spokenDetails}` : ""} Enjoy, have a great time.`;

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
