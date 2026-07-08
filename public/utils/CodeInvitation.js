// Alphabet sans caractères ambigus (pas de 0/O ni 1/I) pour rester lisible
// quand le code est partagé oralement ou par SMS.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGUEUR = 6;

export function genererCodeInvitation() {
  let code = '';
  for (let i = 0; i < LONGUEUR; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
