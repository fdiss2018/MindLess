// Enrobe l'API Web Speech du navigateur (speechSynthesis) — gratuite, 100% côté client, aucune
// dépendance/coût backend (choix acté avec l'utilisateur, voir CLAUDE.md). Qualité de voix
// variable selon l'OS/navigateur ; estDisponible() permet au front de désactiver le bouton
// "Écouter" plutôt que de planter sur un navigateur qui ne supporte pas l'API.
// Brique du cœur : partagée par les modules veille (articles) et memoires (notes, chapitres).
export const LectureVocaleService = {
  estDisponible() {
    return 'speechSynthesis' in window;
  },

  // `surFin` : appelé quand la lecture se termine ou est interrompue (pour remettre le bouton
  // "Écouter" dans son état initial). `vitesse` : 1 = débit normal, < 1 plus lent.
  lire(texte, { surFin, vitesse = 1 } = {}) {
    if (!this.estDisponible()) return;
    window.speechSynthesis.cancel(); // évite d'empiler plusieurs lectures
    const enonce = new SpeechSynthesisUtterance(texte);
    enonce.lang = 'fr-FR';
    enonce.rate = vitesse;
    if (surFin) {
      enonce.onend = surFin;
      enonce.onerror = surFin;
    }
    window.speechSynthesis.speak(enonce);
  },

  enCours() {
    return this.estDisponible() && window.speechSynthesis.speaking;
  },

  arreter() {
    if (this.estDisponible()) window.speechSynthesis.cancel();
  },
};
