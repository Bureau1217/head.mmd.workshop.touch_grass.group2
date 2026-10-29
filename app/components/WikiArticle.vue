<template>
    <div class="barre">
    <span class="texte"><span id="etat">{{ etat }}</span> <span id="raison">{{ raison }}</span>
      <span class="erreur" id="erreur">{{ erreur }}</span></span>
    <button id="test" @click="sauter">Tester un saut</button>
    <a id="ouvrir" :href="urlOuvrir" target="_blank" rel="noopener">Ouvrir sur Wikipédia</a>
    </div>
    <!-- Le vrai site Wikipédia s’affiche ici, avec son habillage d’origine -->
  <iframe id="cadre" :src="urlCadre" title="Article Wikipédia"></iframe>

</template>

<script setup>

import { ref, onMounted, onBeforeUnmount } from "vue";

// ===== 1. RÉGLAGES =====
const MA_POSITION = { lat: 46.2, lon: 6.14 }; // remplacée par ta position GPS si autorisée
const RAYON_KM = 1000;                         // « au-dessus de moi » = sous ce rayon
const INTERVALLE_MS = 5000;
const DOMAINE = "fr.wikipedia.org";            // ou "fr.m.wikipedia.org" pour la version mobile
const SATELLITE = {
  nom: "ISS",
  url: "https://api.wheretheiss.at/v1/satellites/25544",
  mots: ["astronaute", "microgravité", "station spatiale", "vol habité", "expérience en orbite"]
};

// ===== 2. ÉTAT DU COMPOSANT (remplace les document.getElementById) =====
const etat = ref("En attente de la position du satellite…");
const raison = ref("");
const erreur = ref("");
const urlCadre = ref("");
const urlOuvrir = ref("https://" + DOMAINE);

const dejaVus = new Set();
let dedans = null;
let minuteur = null;

function distanceKm(a, b) {
  const rad = x => x * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// ===== 3. CHOISIR UN TITRE SELON LA MISSION =====
async function trouverTitre() {
  const mot = SATELLITE.mots[Math.floor(Math.random() * SATELLITE.mots.length)];
  const url = "https://fr.wikipedia.org/w/api.php?format=json&origin=*&action=query&list=search"
    + "&srnamespace=0&srlimit=30&srsearch=" + encodeURIComponent(mot);
  const d = await (await fetch(url)).json();
  const titres = d.query.search.map(r => r.title).filter(t => !dejaVus.has(t));
  if (!titres.length) throw new Error("Aucun article trouvé pour « " + mot + " »");
  return { titre: titres[Math.floor(Math.random() * titres.length)], mot };
}

// ===== 4. AFFICHER LA VRAIE PAGE : on change l’adresse de l’iframe =====
function afficher(titre) {
  dejaVus.add(titre);
  const chemin = "/wiki/" + encodeURIComponent(titre.replace(/ /g, "_"));
  urlCadre.value = "https://" + DOMAINE + chemin;
  urlOuvrir.value = "https://" + DOMAINE + chemin;
}

async function sauter() {
  erreur.value = "";
  try {
    const { titre, mot } = await trouverTitre();
    afficher(titre);
    raison.value = "Page choisie par la mission de l’" + SATELLITE.nom + " (mot-clé : « " + mot + " »).";
  } catch (e) {
    erreur.value = "Erreur : " + e.message;
  }
}

// ===== 5. SURVEILLER LE SATELLITE =====
async function surveiller() {
  try {
    const s = await (await fetch(SATELLITE.url)).json();
    const km = distanceKm(MA_POSITION, { lat: s.latitude, lon: s.longitude });
    const dansLeRayon = km <= RAYON_KM;
    etat.value = dansLeRayon
      ? "L’" + SATELLITE.nom + " passe au-dessus de toi (" + Math.round(km) + " km)."
      : "L’" + SATELLITE.nom + " est à " + Math.round(km).toLocaleString("fr-FR") + " km de toi.";
    if (dansLeRayon && dedans === false) sauter(); // un seul saut par passage
    dedans = dansLeRayon;
  } catch (e) {
    erreur.value = "Position du satellite indisponible : " + e.message;
  }
}

// ===== 6. DÉMARRAGE : uniquement dans le navigateur =====
// onMounted ne s’exécute jamais côté serveur (SSR) : navigator et le DOM y existent.
onMounted(() => {
  if (typeof navigator !== "undefined" && "geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      p => {
        MA_POSITION.lat = p.coords.latitude;
        MA_POSITION.lon = p.coords.longitude;
      },
      err => console.warn("Géolocalisation impossible, position par défaut utilisée :", err.message),
      { timeout: 10000, maximumAge: 600000 }
    );
  }
  sauter();
  surveiller();
  minuteur = setInterval(surveiller, INTERVALLE_MS);
});

onBeforeUnmount(() => clearInterval(minuteur));

</script>

<style Lang="scss" scoped>
:root {
    color-scheme: light dark
}

html,
body {
    height: 100%;
    margin: 0
}

body {
    display: flex;
    flex-direction: column;
    font: 14px/1.5 system-ui, sans-serif
}

.barre {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
    padding: 8px 14px;
    border-bottom: 1px solid #8886
}

.barre .texte {
    flex: 1;
    min-width: 240px
}

.erreur {
    color: #c0392b
}

button {
    font: inherit;
    padding: 4px 10px;
    cursor: pointer
}

iframe {
    flex: 1;
    width: 100%;
    border: 0;
    background: #fff
}
</style>