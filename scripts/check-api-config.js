import { readFileSync } from 'node:fs';

const chemin = 'public/api-config.js';
const contenu = readFileSync(chemin, 'utf8');

if (contenu.includes('localhost')) {
  console.error(`❌ ${chemin} pointe encore vers localhost — déploiement annulé.`);
  console.error('   Corrige API_BASE_URL vers le backend Cloud Run avant de redéployer.');
  process.exit(1);
}
