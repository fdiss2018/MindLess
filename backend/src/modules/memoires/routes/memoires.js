import { Router } from 'express';
import { MemoiresRepository } from '../repositories/MemoiresRepository.js';
import { GeminiClient } from '../../../coeur/repositories/GeminiClient.js';
import { NoteMemoire } from '../domain/NoteMemoire.js';
import { ChapitreMemoire } from '../domain/ChapitreMemoire.js';
import {
  LONGUEUR_MAX_NOTE, notesASynthetiser, construireRequeteChapitre, validerChapitreIA, normaliserParametres,
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

memoiresRouter.post('/notes', async (req, res, next) => {
  try {
    const texte = typeof req.body.texte === 'string' ? req.body.texte.trim() : '';
    if (!texte) return res.status(400).json({ erreur: 'La note est vide.' });
    if (texte.length > LONGUEUR_MAX_NOTE) {
      return res.status(400).json({ erreur: `La note dépasse ${LONGUEUR_MAX_NOTE} caractères.` });
    }

    const note = new NoteMemoire({ texte, dateCreation: new Date().toISOString() });
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

memoiresRouter.put('/parametres', async (req, res, next) => {
  try {
    const parametres = normaliserParametres(req.body);
    await MemoiresRepository.enregistrerParametres(req.params.foyerId, req.uid, parametres);
    res.json(parametres);
  } catch (err) { next(err); }
});

// Synthèse IA : les notes pas encore synthétisées deviennent un nouveau chapitre (le dernier des
// mémoires), puis sont supprimées ou marquées selon le paramètre du membre. Pas de grounding : les
// souvenirs sont personnels, l'IA ne fait que rédiger à partir des notes.
memoiresRouter.post('/synthetiser', async (req, res, next) => {
  try {
    const { foyerId } = req.params;
    const [notes, chapitres, parametres] = await Promise.all([
      MemoiresRepository.listerNotes(foyerId, req.uid),
      MemoiresRepository.listerChapitres(foyerId, req.uid),
      MemoiresRepository.obtenirParametres(foyerId, req.uid),
    ]);

    const aSynthetiser = notesASynthetiser(notes);
    if (aSynthetiser.length === 0) {
      return res.status(400).json({ erreur: 'Aucune nouvelle note à synthétiser.' });
    }

    const { corpsJSON } = await GeminiClient.generer(
      construireRequeteChapitre({ notes: aSynthetiser, chapitresPrecedents: chapitres }),
    );
    const { titre, contenu } = validerChapitreIA(corpsJSON);

    const chapitre = await MemoiresRepository.enregistrerSynthese(foyerId, req.uid, new ChapitreMemoire({
      titre, contenu, noteIds: aSynthetiser.map((n) => n.id), dateCreation: new Date().toISOString(),
    }), parametres.supprimerNotesApresSynthese);

    res.status(201).json({
      chapitre,
      numero: chapitres.length + 1,
      notesSupprimees: parametres.supprimerNotesApresSynthese,
      notesRestantes: notes.filter((n) => !n.chapitreId).length - aSynthetiser.length,
    });
  } catch (err) { next(err); }
});
