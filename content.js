// Compatibilit\u00e9 multi-navigateurs : Firefox / Zen exposent `browser`,
// Chrome / Edge exposent `chrome`. MV3 alise l'un sur l'autre mais on
// s\u00e9curise l'acc\u00e8s pour \u00e9viter tout ReferenceError.
const runtimeApi =
  typeof browser !== "undefined" && browser.runtime
    ? browser
    : chrome;

let dictionnaire = [];
let derniereSyllabe = "";
let ordreTri = "court";
let motsCliques = [];

function normaliser(mot) {
  return mot
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

fetch(runtimeApi.runtime.getURL("dictionnaire.txt"))
  .then((response) => response.text())
  .then((data) => {
    dictionnaire = data
      .split("\n")
      .map((mot) => normaliser(mot.trim()))
      .filter((mot) => mot.length > 0);
  });

function taperMot(mot) {
  const inputTexte = document.querySelector('input.styled[type="text"]');
  if (!inputTexte) return;
  inputTexte.value = "";
  inputTexte.focus();
  let index = 0;

  function taperCaractere() {
    if (index < mot.length) {
      const caractere = mot[index];
      inputTexte.value += caractere;
      inputTexte.dispatchEvent(
        new InputEvent("input", {
          data: caractere,
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
        }),
      );
      index++;
      let delaiAleatoire = Math.floor(Math.random() * 200);
      setTimeout(taperCaractere, delaiAleatoire);
    } else {
      ["keydown", "keypress", "keyup"].forEach((type) => {
        inputTexte.dispatchEvent(
          new KeyboardEvent(type, {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      if (inputTexte.form) {
        inputTexte.form.dispatchEvent(
          new Event("submit", {
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    }
  }

  taperCaractere();
}

function trierMots(mots) {
  return mots.sort((a, b) =>
    ordreTri === "court" ? a.length - b.length : b.length - a.length,
  );
}

function rechercherMots(syllabe, appliquerLimite = true) {
  const syllabeNorm = normaliser(syllabe);
  let resultat = dictionnaire.filter((mot) => mot.includes(syllabeNorm));
  resultat = trierMots(resultat);
  return appliquerLimite ? resultat.slice(0, 15) : resultat;
}

function afficherMots(mots) {
  let syllableDiv = document.querySelector(".syllable");
  if (!syllableDiv) return;

  let motsContainer = document.getElementById("mots-helper");
  let boutonTri = document.getElementById("bouton-tri");
  let champFiltre = document.getElementById("champ-filtre");

  if (!motsContainer) {
    motsContainer = document.createElement("div");
    motsContainer.id = "mots-helper";
    document.body.appendChild(motsContainer);

    // Bouton de tri
    boutonTri = document.createElement("button");
    boutonTri.id = "bouton-tri";
    boutonTri.innerText = "Ordre de tri";
    boutonTri.onclick = () => {
      ordreTri = ordreTri === "court" ? "long" : "court";

      const champFiltre = document.getElementById("champ-filtre");
      const lettres = champFiltre?.value?.toLowerCase().split("") || [];

      let mots = rechercherMots(derniereSyllabe, false);

      if (lettres.length > 0) {
        mots = mots.filter((mot) => lettres.every((l) => mot.includes(l)));
      }

      afficherMots(mots.slice(0, 15));
    };

    motsContainer.appendChild(boutonTri);

    // Champ filtre
    champFiltre = document.createElement("input");
    champFiltre.id = "champ-filtre";
    champFiltre.placeholder = "Filtrer par lettres (ex: abce)";
    champFiltre.type = "text";
    champFiltre.oninput = () => {
      const lettres = champFiltre.value.toLowerCase().split("");
      const tousLesMots = rechercherMots(derniereSyllabe, false); // ← ne pas limiter ici
      const motsFiltres = tousLesMots.filter((mot) =>
        lettres.every((l) => mot.includes(l)),
      );
      afficherMots(motsFiltres.slice(0, 15)); // ← limite seulement ici
    };

    motsContainer.appendChild(champFiltre);

    Object.assign(champFiltre.style, {
      display: "block",
      width: "100%",
      marginBottom: "10px",
      padding: "5px",
      fontSize: "16px",
      borderRadius: "5px",
      border: "1px solid #ccc",
    });

    Object.assign(boutonTri.style, {
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
  }

  // Nettoyage partiel, on garde les champs déjà créés
  Array.from(motsContainer.children).forEach((child) => {
    if (child !== boutonTri && child !== champFiltre) {
      motsContainer.removeChild(child);
    }
  });

  // Filtrer les mots déjà cliqués
  mots = mots.filter((mot) => !motsCliques.includes(mot));

  mots.forEach((mot) => {
    let motDiv = document.createElement("div");
    motDiv.innerText = mot;
    motDiv.style.cursor = "pointer";
    motDiv.onclick = () => {
      taperMot(mot);
      if (!motsCliques.includes(mot)) {
        motsCliques.push(mot);
      }
      afficherMots(rechercherMots(derniereSyllabe));
    };
    motsContainer.appendChild(motDiv);
  });

  Object.assign(motsContainer.style, {
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
}

function detecterNouvelleSyllabe() {
  const syllableDiv = document.querySelector(".syllable");
  if (!syllableDiv) return;
  const syllabe = normaliser(syllableDiv.textContent.trim());
  if (syllabe && syllabe !== derniereSyllabe) {
    derniereSyllabe = syllabe;
    const motsTrouvés = rechercherMots(syllabe);
    afficherMots(motsTrouvés);
  }
}

const observer = new MutationObserver(() => detecterNouvelleSyllabe());
const observerContainer = new MutationObserver(() => {
  const syllableDiv = document.querySelector(".syllable");
  if (syllableDiv) {
    observer.observe(syllableDiv, { childList: true, subtree: true });
    detecterNouvelleSyllabe();
    observerContainer.disconnect();
  }
});
observerContainer.observe(document.body, { childList: true, subtree: true });
