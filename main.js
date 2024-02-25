async function fetchImage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${await getScryfallError(response)}`);
  }

  const blob = await response.blob();

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
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
}

function makeQuery(params, separator) {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join(separator);
}

function showAlert(element) {
  element.classList.remove("d-none");
  element.classList.add("show");
}

function hideAlert(element) {
  element.classList.add("d-none");
  element.classList.remove("show");
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
    window.open(`rawbt:${image}`);
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
      "-name:Asmoranomardicadaistinaculdacar",
      `cmc:${manaValue}`,
    ].join("+"),
    format: "image",
    version: "border_crop",
  }, "&");

  const url = `https://api.scryfall.com/cards/random?${query}`;

  addCurrentCardToHistory();
  document.getElementById("card-image").classList.add("d-none");

  const loadingAlert = document.getElementById("loadingAlert");
  const errorAlert = document.getElementById("errorAlert");

  showAlert(loadingAlert);
  hideAlert(errorAlert);

  const buttons = document.querySelectorAll(".momir-button");
  buttons.forEach(button => {
    button.disabled = true;
  });

  fetchImage(url)
    .then(image => printImage(image))
    .catch(error => {
      console.error(error);
      errorAlert.textContent = error.message;
      showAlert(errorAlert);
    })
    .finally(() => {
      hideAlert(loadingAlert);

      buttons.forEach(button => {
        button.disabled = false;
      });
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
        card.classList.remove("d-none");

        const previousCard = history.children[history.children.length - 1];
        history.removeChild(previousCard);
        card.src = previousCard.src;
      }
    }
  });
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    document.getElementById("controls").classList.remove("d-none");
  }
});

document.getElementById("fullscreen-button").addEventListener("click", event => {
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
