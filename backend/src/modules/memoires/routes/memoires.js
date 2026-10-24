import { Router } from 'express';
import { MemoiresRepository } from '../repositories/MemoiresRepository.js';
import { GeminiClient } from '../../../coeur/repositories/GeminiClient.js';
import { NoteMemoire } from '../domain/NoteMemoire.js';
import { ChapitreMemoire } from '../domain/ChapitreMemoire.js';
import {
  LONGUEUR_MAX_NOTE, LONGUEUR_MAX_STYLE, TYPES_NOTE, typeNote, selectionnerPourSynthese,
  construireRequeteChapitre, validerChapitreIA, normaliserParametres,
} from '../domain/SyntheseMemoires.js';

// Monté sur /api/foyers/:foyerId/memoires. Toutes les routes portent sur les mémoires de
// l'appelant (req.uid) : chacun n'accède qu'aux siennes, même si plusieurs membres du foyer ont
// le module.
export const memoiresRouter = Router({ mergeParams: true });

memoiresRouter.get('/notes', async (req, res, next) => {
  try {
    res.json(await MemoiresRepository.listerNotes(req.params.foyerId, req.uid));
  } catch (err) { next(err); }
});

// Body : { texte, type? } — type 'souvenir' (défaut) ou 'instruction'.
memoiresRouter.post('/notes', async (req, res, next) => {
  try {
    const texte = typeof req.body.texte === 'string' ? req.body.texte.trim() : '';
    const type = req.body.type ?? 'souvenir';
    if (!TYPES_NOTE.includes(type)) return res.status(400).json({ erreur: 'Type de note inconnu.' });
    if (!texte) return res.status(400).json({ erreur: 'La note est vide.' });
    if (texte.length > LONGUEUR_MAX_NOTE) {
      return res.status(400).json({ erreur: `La note dépasse ${LONGUEUR_MAX_NOTE} caractères.` });
    }

    const note = new NoteMemoire({ texte, type, dateCreation: new Date().toISOString() });
    const id = await MemoiresRepository.ajouterNote(req.params.foyerId, req.uid, note);
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

memoiresRouter.delete('/notes/:noteId', async (req, res, next) => {
  try {
    await MemoiresRepository.supprimerNote(req.params.foyerId, req.uid, req.params.noteId);
    res.status(204).end();
  } catch (err) { next(err); }
});

memoiresRouter.get('/chapitres', async (req, res, next) => {
  try {
    res.json(await MemoiresRepository.listerChapitres(req.params.foyerId, req.uid));
  } catch (err) { next(err); }
});

memoiresRouter.delete('/chapitres/:chapitreId', async (req, res, next) => {
  try {
    const notesLiberees = await MemoiresRepository.supprimerChapitre(
      req.params.foyerId, req.uid, req.params.chapitreId,
    );
    res.json({ notesLiberees });
  } catch (err) { next(err); }
});

memoiresRouter.get('/parametres', async (req, res, next) => {
  try {
    res.json(await MemoiresRepository.obtenirParametres(req.params.foyerId, req.uid));
  } catch (err) { next(err); }
});

// Remplace l'ensemble des paramètres (Settings envoie toujours tous les champs) :
// { supprimerNotesApresSynthese, styleSynthese }.
memoiresRouter.put('/parametres', async (req, res, next) => {
  try {
    const parametres = normaliserParametres(req.body);
    if (parametres.styleSynthese.length > LONGUEUR_MAX_STYLE) {
      return res.status(400).json({ erreur: `Le style dépasse ${LONGUEUR_MAX_STYLE} caractères.` });
    }
    await MemoiresRepository.enregistrerParametres(req.params.foyerId, req.uid, parametres);
    res.json(parametres);
  } catch (err) { next(err); }
});

// Synthèse IA : les souvenirs pas encore utilisés deviennent un nouveau chapitre (le dernier des
// mémoires), écrit dans le style des paramètres du membre et selon ses instructions en attente ;
// souvenirs et instructions sont ensuite supprimés ou rattachés au chapitre selon son paramètre.
// Pas de grounding : les souvenirs sont personnels, l'IA ne fait que rédiger à partir des notes.
memoiresRouter.post('/synthetiser', async (req, res, next) => {
  try {
    const { foyerId } = req.params;
    const [notes, chapitres, parametres] = await Promise.all([
      MemoiresRepository.listerNotes(foyerId, req.uid),
      MemoiresRepository.listerChapitres(foyerId, req.uid),
      MemoiresRepository.obtenirParametres(foyerId, req.uid),
    ]);

    const { souvenirs, instructions } = selectionnerPourSynthese(notes);
    if (souvenirs.length === 0) {
      return res.status(400).json({ erreur: 'Aucun nouveau souvenir à synthétiser.' });
    }

    const { corpsJSON } = await GeminiClient.generer(construireRequeteChapitre({
      souvenirs, instructions, style: parametres.styleSynthese, chapitresPrecedents: chapitres,
    }));
    const { titre, contenu } = validerChapitreIA(corpsJSON);

    const noteIds = [...souvenirs, ...instructions].map((n) => n.id);
    const chapitre = await MemoiresRepository.enregistrerSynthese(foyerId, req.uid, new ChapitreMemoire({
      titre, contenu, noteIds, dateCreation: new Date().toISOString(),
    }), parametres.supprimerNotesApresSynthese);

    const souvenirsDisponibles = notes.filter((n) => !n.chapitreId && typeNote(n) === 'souvenir').length;
    res.status(201).json({
      chapitre,
      numero: chapitres.length + 1,
      notesSupprimees: parametres.supprimerNotesApresSynthese,
      souvenirsRestants: souvenirsDisponibles - souvenirs.length,
    });
  } catch (err) { next(err); }
});
