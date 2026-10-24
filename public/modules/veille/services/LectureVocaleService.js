// Enrobe l'API Web Speech du navigateur (speechSynthesis) — gratuite, 100% côté client, aucune
// dépendance/coût backend (choix acté avec l'utilisateur, voir CLAUDE.md). Qualité de voix
// variable selon l'OS/navigateur ; estDisponible() permet au front de désactiver le bouton
// "Écouter" plutôt que de planter sur un navigateur qui ne supporte pas l'API.
export const LectureVocaleService = {
  estDisponible() {
    return 'speechSynthesis' in window;
  },

  lire(texte) {
    if (!this.estDisponible()) return;
    window.speechSynthesis.cancel(); // évite d'empiler plusieurs lectures
    const enonce = new SpeechSynthesisUtterance(texte);
    enonce.lang = 'fr-FR';
    window.speechSynthesis.speak(enonce);
  },

  enCours() {
    return this.estDisponible() && window.speechSynthesis.speaking;
  },

  arreter() {
    if (this.estDisponible()) window.speechSynthesis.cancel();
  },
};
