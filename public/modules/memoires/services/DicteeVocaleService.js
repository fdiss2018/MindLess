// Dictée vocale : enrobe l'API Web Speech du navigateur (SpeechRecognition) — gratuite, côté
// client, pour des personnes peu à l'aise avec un clavier. Disponible sur Chrome/Edge (ordinateur
// et Android) et Safari ; absente de Firefox : estDisponible() permet d'afficher une alternative
// (micro du clavier du téléphone). Sur Chrome, l'audio est transcrit par les serveurs de Google.
//
// Propre au module memoires pour l'instant — à remonter dans coeur/services/ si un autre module en
// a besoin (même chemin que LectureVocaleService, voir CLAUDE.md "Règles de dépendance").
import { assemblerDictee } from '../utils/TexteDicte.js';

const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;

const MESSAGES_ERREUR = {
  'not-allowed': "Autorise l'accès au micro pour pouvoir dicter.",
  'service-not-allowed': "Autorise l'accès au micro pour pouvoir dicter.",
  'audio-capture': 'Aucun micro n\'a été trouvé.',
  network: 'La dictée a besoin d\'une connexion internet.',
};

let reconnaissance = null;
let active = false;
let segmentsFinaux = [];
let segmentsSession = [];

export const DicteeVocaleService = {
  estDisponible() {
    return !!Reconnaissance;
  },

  // Démarre une dictée. `surTexte(texteFinal, texteProvisoire)` reçoit à chaque résultat tout le
  // texte définitivement reconnu depuis le démarrage (mis en forme) et la phrase en cours de
  // reconnaissance. Chaque phrase (entre deux pauses) termine une session de reconnaissance, relancée
  // aussitôt tant que arreter() n'a pas été appelé — plus fiable que le mode continu, qui duplique
  // les résultats sur Chrome Android. `surFin()` : dictée terminée ; `surErreur(message)`.
  demarrer({ surTexte, surFin, surErreur }) {
    if (!Reconnaissance || active) return;
    active = true;
    segmentsFinaux = [];

    const lancer = () => {
      segmentsSession = [];
      reconnaissance = new Reconnaissance();
      reconnaissance.lang = 'fr-FR';
      reconnaissance.continuous = false;
      reconnaissance.interimResults = true;

      reconnaissance.onresult = (event) => {
        const finaux = [];
        let provisoire = '';
        for (const resultat of event.results) {
          if (resultat.isFinal) finaux.push(resultat[0].transcript);
          else provisoire += resultat[0].transcript;
        }
        segmentsSession = finaux;
        surTexte(assemblerDictee([...segmentsFinaux, ...segmentsSession]), provisoire.trim());
      };

      reconnaissance.onerror = (event) => {
        // Un silence ou une interruption volontaire n'est pas une erreur : onend relance ou termine.
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        active = false;
        surErreur?.(MESSAGES_ERREUR[event.error] || 'La dictée s\'est interrompue, réessaie.');
      };

      reconnaissance.onend = () => {
        segmentsFinaux.push(...segmentsSession);
        segmentsSession = [];
        if (active) {
          try { lancer(); return; } catch { active = false; }
        }
        surFin?.();
      };

      reconnaissance.start();
    };

    lancer();
  },

  arreter() {
    active = false;
    reconnaissance?.stop();
  },

  enCours() {
    return active;
  },
};
