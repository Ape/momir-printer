async function fetchImage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${await getScryfallError(response)}`);
  }

  const blob = await response.blob();

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function getScryfallError(response) {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const error = await response.json();

    if ("warnings" in error) {
      return `${error.details} ${error.warnings}`;
    }

    return error.details;
  }

  return await response.text();
}

function addToHistory(image) {
  const history = document.getElementById("history");
  const element = document.createElement("img");
  element.src = image;
  element.alt = "previous card image";
  element.classList.add("history-image");

  element.addEventListener("click", () => {
    history.removeChild(element);
    addCurrentCardToHistory();
    printImage(image);
  });

  history.appendChild(element);

  while (history.children.length > 5) {
    history.removeChild(history.children[0]);
  }
}

function addCurrentCardToHistory() {
  const card = document.getElementById("card-image");
  if (!card.classList.contains("d-none")) {
    addToHistory(card.src);
  }
}

function getPrintMode() {
  const modeSelection = document.getElementById("mode-selection");
  return modeSelection.querySelector("input[name='mode']:checked").value;
}

function showImage(url) {
  const card = document.getElementById("card-image");
  card.src = url;
  card.classList.remove("d-none");

  document.getElementById("content").classList.add("d-print-none");
  document.getElementById("controls").classList.add("d-print-none");

  hideLoading();
}

function printRawbt(image){
  showLoading("Printing...")

  const socket = new WebSocket("ws://localhost:40213/");

  socket.addEventListener("error", event => showError("Failed to connect to RawBT WS API"));

  socket.addEventListener("open", event => {
    const job = {commands: [{
      command: "image",
      base64: image.split(",")[1],
      attributesImage: {
        graphicFilter: 2, // Atkinson filter
      },
    }]};

    socket.send(JSON.stringify(job));
  });

  socket.addEventListener("message", event => {
    response = JSON.parse(event.data);

    switch (response.responseType) {
    case "progress":
      showLoading(`Printing... ${100 * response.progress} %`);
      break;
    case "success":
      hideLoading();
      socket.close();
      break;
    case "error":
      showError(`RawBT error: ${response.errorMessage}`);
      socket.close();
      break;
    default:
      showError(`Unknown RawBT response: ${event.data}`);
      socket.close();
    }
  });
}

function makeQuery(params, separator) {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join(separator);
}

function setButtonsDisabled(value = true) {
  const buttons = document.querySelectorAll(".momir-button");
  buttons.forEach(button => {
    button.disabled = value;
  });
}

function showAlert(element) {
  element.classList.remove("d-none");
  element.classList.add("show");
}

function hideAlert(element) {
  element.classList.add("d-none");
  element.classList.remove("show");
}

function showLoading(message) {
  document.getElementById("loadingMessage").textContent = message;
  showAlert(document.getElementById("loadingAlert"));
  setButtonsDisabled();
}

function showError(message) {
  const errorAlert = document.getElementById("errorAlert");

  console.error(message);
  errorAlert.textContent = message;
  showAlert(errorAlert);
  hideLoading();
}

function hideLoading() {
  hideAlert(document.getElementById("loadingAlert"));
  setButtonsDisabled(false);
}

function hideError() {
  hideAlert(document.getElementById("errorAlert"));
}

function printImage(image) {
  const mode = getPrintMode();
  switch (mode) {
  case "show":
    showImage(image);
    break;
  case "print":
    showImage(image);
    window.print();
    break;
  case "rawbt":
    printRawbt(image);
    addToHistory(image);
    break;
  default:
    console.error(`Unknown print mode: ${mode}`);
  }
}

function momir(manaValue) {
  const query = makeQuery({
    q: [
      "legal:vintage",
      "-set_type:funny", // No unsets
      "type:/^[^\\/]*Creature/", // Creature on the front side
      "-type:land",
      "-mana>=x", // No {X} in the mana cost
      "-mana:/^$/", // No cards without a mana cost
      `cmc:${manaValue}`,
    ].join("+"),
    format: "image",
    version: "border_crop",
  }, "&");

  const url = `https://api.scryfall.com/cards/random?${query}`;

  addCurrentCardToHistory();
  document.getElementById("card-image").classList.add("d-none");

  hideError();
  showLoading("Fetching image...");

  fetchImage(url)
    .then(image => printImage(image))
    .catch(error => {
      showError(error.message);
      hideLoading();
    });
}

document.getElementById("card-image").addEventListener("click", event => {
  if (getPrintMode() == "print") {
    window.print();
  }
});

document.querySelectorAll("input[name='mode']").forEach(radio => {
  radio.addEventListener("input", event => {
    localStorage.setItem("momir-printMode", event.target.value);

    const card = document.getElementById("card-image")

    if (event.target.value == "rawbt") {
      addCurrentCardToHistory();
      card.classList.add("d-none");
    } else if (card.classList.contains("d-none")) {
      const history = document.getElementById("history");

      if (history.children.length > 0) {
        const previousCard = history.children[history.children.length - 1];
        history.removeChild(previousCard);
        showImage(previousCard.src);
      }
    }
  });
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    document.getElementById("controls").classList.remove("d-none");
  }
});

document.getElementById("zen-button").addEventListener("click", event => {
  document.getElementById("controls").classList.add("d-none");

  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("momir-buttons");

  [...Array(14).keys(), 15, 16].forEach(x => {
    const button = document.createElement("button");
    button.textContent = x;
    button.classList.add("momir-button", "btn", "btn-primary");
    button.addEventListener("click", () => momir(x));
    container.appendChild(button);
  });

  const savedMode = localStorage.getItem("momir-printMode");
  const modeElement = document.querySelector(`input[name="mode"][value="${savedMode}"]`);
  if (savedMode && modeElement) {
    modeElement.checked = true;
  }
});
