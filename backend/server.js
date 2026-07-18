import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authentifier } from './src/commun/middleware/auth.js';
import { whoamiRouter } from './src/commun/routes/whoami.js';
import { utilisateursRouter } from './src/commun/routes/utilisateurs.js';
import { foyersRouter } from './src/commun/routes/foyers.js';
import { vehiculesRouter } from './src/voiture/routes/vehicules.js';
import { entretiensRouter } from './src/voiture/routes/entretiens.js';
import { recettesRouter } from './src/menus/routes/recettes.js';
import { planningRouter } from './src/menus/routes/planning.js';
import { listeCoursesRouter } from './src/menus/routes/listeCourses.js';
import { nutritionRouter } from './src/menus/routes/nutrition.js';

const app = express();

const originsAutorisees = (process.env.CORS_ALLOWED_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Pas d'en-tête Origin (Postman, curl, appels serveur-à-serveur) : autorisé.
    if (!origin || originsAutorisees.includes(origin)) return callback(null, true);
    callback(new Error(`Origine non autorisée : ${origin}`));
  },
}));
app.use(express.json());

app.use('/api', authentifier, whoamiRouter);
app.use('/api/utilisateurs', authentifier, utilisateursRouter);
app.use('/api/foyers', authentifier, foyersRouter);
app.use('/api/foyers/:foyerId/vehicules', authentifier, vehiculesRouter);
app.use('/api/foyers/:foyerId/vehicules/:vehiculeId/entretiens', authentifier, entretiensRouter);
app.use('/api/foyers/:foyerId/recettes', authentifier, recettesRouter);
app.use('/api/foyers/:foyerId/planning', authentifier, planningRouter);
app.use('/api/foyers/:foyerId/liste-courses', authentifier, listeCoursesRouter);
app.use('/api/foyers/:foyerId/nutrition', authentifier, nutritionRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erreur: err.message || 'Erreur serveur.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend MindLess démarré sur le port ${port}`));
