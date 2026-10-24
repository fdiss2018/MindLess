// Contribution du module memoires à la page Settings (point d'extension `parametres`, voir
// coeur/utils/Modules.js) : réglages personnels de la synthèse des souvenirs en chapitres.
// Chargé dynamiquement par settings.html, seulement si le module est ouvert à l'utilisateur.
import { MemoiresService } from './services/MemoiresService.js';

export async function afficherParametres(conteneur, session) {
  const foyerId = session.foyer.id;
  const parametres = await MemoiresService.obtenirParametres(foyerId);

  // Structure statique en HTML ; les valeurs saisies (style) ne passent que par .value.
  conteneur.innerHTML = `
    <label class="ligne-acces">
      <input type="checkbox" data-champ="supprimer"> Supprimer mes notes une fois le chapitre écrit
    </label>
    <p class="carte-desc">Sinon, elles restent dans Memory, rangées dans « Déjà dans mes mémoires ».</p>
    <div class="champ" style="margin-top:14px">
      <label for="memoires-style">Style des chapitres</label>
      <textarea id="memoires-style" class="input" rows="4" data-champ="style"
        placeholder="Ex. : un ton léger avec un peu d'humour, des phrases courtes, écrit pour mes petits-enfants."></textarea>
      <p class="carte-desc">Appliqué par l'IA à chaque chapitre. Laisse vide pour un style simple et chaleureux.</p>
    </div>
    <button class="btn-primaire" data-champ="enregistrer">Enregistrer</button>
    <p class="msg hidden" data-champ="msg"></p>
  `;
  const champ = (nom) => conteneur.querySelector(`[data-champ="${nom}"]`);
  const caseSupprimer = champ('supprimer');
  const zoneStyle = champ('style');
  const bouton = champ('enregistrer');
  const msg = champ('msg');

  caseSupprimer.checked = parametres.supprimerNotesApresSynthese;
  zoneStyle.value = parametres.styleSynthese;

  bouton.addEventListener('click', async () => {
    bouton.disabled = true;
    try {
      await MemoiresService.enregistrerParametres(foyerId, {
        supprimerNotesApresSynthese: caseSupprimer.checked,
        styleSynthese: zoneStyle.value,
      });
      msg.textContent = 'Réglages de Memory enregistrés.';
      msg.className = 'msg msg-ok';
    } catch (err) {
      msg.textContent = err.message || "Les réglages n'ont pas pu être enregistrés.";
      msg.className = 'msg msg-erreur';
    } finally {
      bouton.disabled = false;
    }
  });
}
