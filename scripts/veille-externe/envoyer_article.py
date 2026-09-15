#!/usr/bin/env python3
"""
Pousse un ou plusieurs articles (JSON produits par le Gem "Éclaireur IA", voir
prompt-gem-veille-ia.md) vers l'API externe de veille de MindLess :
POST /api/foyers/:foyerId/articles/externe

Usage :
    python envoyer_article.py                  # traite tous les .json de articles-a-importer/
    python envoyer_article.py mon_article.json # traite un seul fichier (n'importe quel chemin)

Configuration : copier config.example.json en config.json (gitignoré, jamais committé) à côté de
ce script, et renseigner les 4 valeurs. Le token et l'uid ne doivent JAMAIS être commités.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

import requests

# Sans ça, la console Windows par défaut (cp1252) plante sur les ✅/❌ ci-dessous
# (UnicodeEncodeError) — vu en test réel sur ce poste.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DOSSIER_SCRIPT = Path(__file__).resolve().parent
DOSSIER_A_IMPORTER = DOSSIER_SCRIPT / "articles-a-importer"
DOSSIER_TRAITES = DOSSIER_A_IMPORTER / "traites"
FICHIER_CONFIG = DOSSIER_SCRIPT / "config.json"

CHAMPS_REQUIS = ("titre", "categorie", "contenu")


def charger_config():
    if not FICHIER_CONFIG.exists():
        sys.exit(
            f"Config manquante : {FICHIER_CONFIG}\n"
            "Copie config.example.json en config.json et renseigne les 4 valeurs."
        )
    config = json.loads(FICHIER_CONFIG.read_text(encoding="utf-8"))
    manquants = [c for c in ("apiBaseUrl", "foyerId", "staticApiToken", "uid") if not config.get(c)]
    if manquants:
        sys.exit(f"Config incomplète, champs manquants : {', '.join(manquants)}")
    return config


def valider_article(donnees, nom_fichier):
    manquants = [c for c in CHAMPS_REQUIS if not donnees.get(c)]
    if manquants:
        return f"{nom_fichier} : champs manquants ou vides ({', '.join(manquants)})"
    return None


def envoyer_article(config, donnees):
    url = f"{config['apiBaseUrl']}/api/foyers/{config['foyerId']}/articles/externe"
    reponse = requests.post(
        url,
        json={
            "titre": donnees["titre"],
            "categorie": donnees["categorie"],
            "contenu": donnees["contenu"],
            "contenuAudio": donnees.get("contenuAudio"),
            "motsCles": donnees.get("motsCles", []),
        },
        headers={
            "Authorization": f"Bearer {config['staticApiToken']}",
            "X-Test-Uid": config["uid"],
            "Content-Type": "application/json",
        },
        timeout=30,
    )
    return reponse


def traiter_fichier(config, chemin_fichier):
    nom = chemin_fichier.name
    try:
        donnees = json.loads(chemin_fichier.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        print(f"❌ {nom} : JSON invalide ({err})")
        return False

    erreur = valider_article(donnees, nom)
    if erreur:
        print(f"❌ {erreur}")
        return False

    try:
        reponse = envoyer_article(config, donnees)
    except requests.RequestException as err:
        print(f"❌ {nom} : erreur réseau ({err})")
        return False

    if reponse.status_code == 201:
        article_id = reponse.json().get("id", "?")
        print(f"✅ {nom} : importé (id={article_id})")
        # Déplacé plutôt que supprimé, pour garder une trace et ne jamais le repousser deux fois.
        DOSSIER_TRAITES.mkdir(parents=True, exist_ok=True)
        horodatage = datetime.now().strftime("%Y%m%d-%H%M%S")
        chemin_fichier.rename(DOSSIER_TRAITES / f"{horodatage}-{nom}")
        return True

    try:
        message = reponse.json().get("erreur", reponse.text)
    except ValueError:
        message = reponse.text
    print(f"❌ {nom} : {reponse.status_code} — {message}")
    return False


def main():
    config = charger_config()

    if len(sys.argv) > 1:
        fichiers = [Path(sys.argv[1])]
    else:
        DOSSIER_A_IMPORTER.mkdir(parents=True, exist_ok=True)
        fichiers = sorted(DOSSIER_A_IMPORTER.glob("*.json"))

    if not fichiers:
        print(f"Aucun fichier .json à traiter dans {DOSSIER_A_IMPORTER}")
        return

    reussites = sum(traiter_fichier(config, f) for f in fichiers if f.exists())
    print(f"\n{reussites}/{len(fichiers)} article(s) importé(s).")
    if reussites < len(fichiers):
        sys.exit(1)


if __name__ == "__main__":
    main()
