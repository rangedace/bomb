// Cross-browser runtime: Firefox/Zen expose `browser`, Chrome/Edge expose
// `chrome`. MV3 aliases one onto the other, but we resolve it defensively.
const runtime = (
  typeof browser !== "undefined" && browser.runtime ? browser : chrome
).runtime;

const MAX_RESULTS = 15;
const MAX_TYPING_DELAY_MS = 200;

let dictionary = [];
let currentSyllable = "";
let sortOrder = "short"; // "short" | "long"
let clickedWords = new Set(); // words already submitted this game
let currentMatches = []; // words containing currentSyllable (cached, unsorted)

// UI references (created once, reused on every render).
let panel = null;
let sortButton = null;
let filterInput = null;
let wordList = null;

function normalize(word) {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

fetch(runtime.getURL("dictionnaire.txt"))
  .then((response) => response.text())
  .then((data) => {
    dictionary = data
      .split("\n")
      .map((word) => normalize(word.trim()))
      .filter((word) => word.length > 0);
  });

function typeWord(word) {
  const input = document.querySelector('input.styled[type="text"]');
  if (!input) return;

  input.value = "";
  input.focus();
  let index = 0;

  function typeChar() {
    if (index < word.length) {
      const char = word[index];
      input.value += char;
      input.dispatchEvent(
        new InputEvent("input", {
          data: char,
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
        }),
      );
      index++;
      setTimeout(typeChar, Math.floor(Math.random() * MAX_TYPING_DELAY_MS));
    } else {
      for (const type of ["keydown", "keypress", "keyup"]) {
        input.dispatchEvent(
          new KeyboardEvent(type, {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
      input.form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    }
  }

  typeChar();
}

function sortWords(words) {
  const factor = sortOrder === "short" ? 1 : -1;
  return [...words].sort((a, b) => factor * (a.length - b.length));
}

// Derive the visible list from the cached matches: drop already-used words,
// apply the letter filter, sort, then cap the count.
function getDisplayWords() {
  const letters = (filterInput?.value || "").toLowerCase().split("");
  let words = currentMatches.filter((word) => !clickedWords.has(word));
  if (letters.length > 0) {
    words = words.filter((word) => letters.every((l) => word.includes(l)));
  }
  return sortWords(words).slice(0, MAX_RESULTS);
}

function buildUI() {
  panel = document.createElement("div");
  panel.id = "bombparty-helper";
  Object.assign(panel.style, {
    position: "absolute",
    top: "40px",
    left: "40px",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    color: "white",
    padding: "10px",
    borderRadius: "8px",
    fontSize: "16px",
    fontFamily: "Arial, sans-serif",
    maxWidth: "300px",
    maxHeight: "300px",
    overflowY: "auto",
    zIndex: "9999",
    boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.5)",
  });

  sortButton = document.createElement("button");
  sortButton.id = "sort-button";
  sortButton.innerText = "Sort order";
  sortButton.onclick = () => {
    sortOrder = sortOrder === "short" ? "long" : "short";
    renderWords();
  };
  Object.assign(sortButton.style, {
    display: "block",
    width: "100%",
    marginBottom: "10px",
    padding: "5px",
    cursor: "pointer",
    backgroundColor: "#fff",
    color: "#000",
    border: "none",
    borderRadius: "5px",
    fontWeight: "bold",
  });

  filterInput = document.createElement("input");
  filterInput.id = "filter-input";
  filterInput.type = "text";
  filterInput.placeholder = "Filter by letters (e.g. abce)";
  filterInput.oninput = renderWords;
  Object.assign(filterInput.style, {
    display: "block",
    width: "100%",
    marginBottom: "10px",
    padding: "5px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "1px solid #ccc",
  });

  wordList = document.createElement("div");
  wordList.id = "word-list";

  panel.append(sortButton, filterInput, wordList);
  document.body.appendChild(panel);
}

function renderWords() {
  if (!panel) buildUI();

  wordList.textContent = "";
  for (const word of getDisplayWords()) {
    const row = document.createElement("div");
    row.textContent = word;
    row.style.cursor = "pointer";
    row.onclick = () => {
      typeWord(word);
      clickedWords.add(word);
      renderWords();
    };
    wordList.appendChild(row);
  }
}

// Recompute matches only when the syllable actually changes.
function handleSyllableChange() {
  const syllableDiv = document.querySelector(".syllable");
  if (!syllableDiv) return;

  const syllable = normalize(syllableDiv.textContent.trim());
  if (!syllable || syllable === currentSyllable) return;

  currentSyllable = syllable;
  currentMatches = dictionary.filter((word) => word.includes(syllable));
  renderWords();
}

// Reset the used-word list whenever the syllable element (re)appears, which
// marks the start of a new game.
let syllablePresent = false;
const syllableObserver = new MutationObserver(handleSyllableChange);
const bodyObserver = new MutationObserver(() => {
  const syllableDiv = document.querySelector(".syllable");
  if (syllableDiv && !syllablePresent) {
    syllablePresent = true;
    clickedWords.clear();
    currentSyllable = "";
    syllableObserver.observe(syllableDiv, { childList: true, subtree: true });
    handleSyllableChange();
  } else if (!syllableDiv && syllablePresent) {
    syllablePresent = false;
    syllableObserver.disconnect();
  }
});
bodyObserver.observe(document.body, { childList: true, subtree: true });
