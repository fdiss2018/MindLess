import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authentifier } from './src/coeur/middleware/auth.js';
import { monterModule } from './src/coeur/monterModule.js';
import { whoamiRouter } from './src/coeur/routes/whoami.js';
import { sessionRouter } from './src/coeur/routes/session.js';
import { utilisateursRouter } from './src/coeur/routes/utilisateurs.js';
import { foyersRouter } from './src/coeur/routes/foyers.js';
import { moduleVoiture } from './src/modules/voiture/module.js';
import { moduleCourses } from './src/modules/courses/module.js';
import { moduleMenus } from './src/modules/menus/module.js';
import { moduleVeille } from './src/modules/veille/module.js';
import { moduleMemoires } from './src/modules/memoires/module.js';

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

// Résout l'appelant une seule fois pour tout /api (ne bloque jamais sans token, voir auth.js) —
// chaque route impose ensuite ce dont elle a besoin (requireUid, requireMembreFoyer...).
app.use('/api', authentifier);

// Cœur : identité, session, foyer, droits d'accès aux modules.
app.use('/api', whoamiRouter);
app.use('/api', sessionRouter);
app.use('/api/utilisateurs', utilisateursRouter);
app.use('/api/foyers', foyersRouter);

// Modules fonctionnels : chacun décrit ses routes dans son manifeste, le cœur les monte derrière
// le contrôle d'accès au module (voir coeur/monterModule.js). Ajouter un module = une ligne ici.
[moduleVoiture, moduleCourses, moduleMenus, moduleVeille, moduleMemoires].forEach((module) => monterModule(app, module));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erreur: err.message || 'Erreur serveur.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend MindLess démarré sur le port ${port}`));
