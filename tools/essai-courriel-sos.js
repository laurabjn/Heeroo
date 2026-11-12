#!/usr/bin/env node
// Essai reel de la messagerie des alertes SOS.
//
//   node tools/essai-courriel-sos.js <destinataire> [hote] [port]
//
// Exemple :
//   node tools/essai-courriel-sos.js laura.bojon@gmail.com
//   node tools/essai-courriel-sos.js contact@heeroo.fr mail31.lwspanel.com
//
// Pourquoi ce script existe. Les essais unitaires couvrent la composition du
// message et le comportement du transport avec des doublures, mais ils ne
// peuvent pas prouver qu'un serveur SMTP reel accepte ces identifiants. C'est
// pourtant le seul point qui ne se verrait qu'au pire moment : le jour ou un
// chauffeur appuie sur le bouton.
//
// Le mot de passe est demande au clavier et n'est JAMAIS affiche, jamais
// ecrit sur le disque, jamais passe en argument — un argument resterait dans
// l'historique du terminal et dans la liste des processus.
//
// Le message envoye est EXACTEMENT celui que la fonction serveur composerait,
// fabrique par le meme code (functions/lib/alerteSOS.js), avec un jeu de
// donnees d'exemple. Ce qui arrive dans la boite est donc ce que Heeroo
// recevra vraiment, a ceci pres que le sujet est prefixe par [ESSAI].

const path = require('path');
const readline = require('readline');

const RACINE = path.join(__dirname, '..');
const FONCTIONS = path.join(RACINE, 'functions');

let composerCourriel;
let nodemailer;
try {
    ({ composerCourriel } = require(path.join(FONCTIONS, 'lib', 'alerteSOS')));
    nodemailer = require(path.join(FONCTIONS, 'node_modules', 'nodemailer'));
} catch (erreur) {
    console.error('Modules introuvables. Lancez d abord : cd functions && npm install');
    console.error(erreur.message);
    process.exit(1);
}

const destinataire = process.argv[2];
const hote = process.argv[3] || 'mail.heeroo.fr';
const port = Number(process.argv[4]) || 465;
const utilisateur = process.env.SOS_SMTP_USER || 'contact@heeroo.fr';

if (!destinataire || destinataire.indexOf('@') < 1) {
    console.error('Usage : node tools/essai-courriel-sos.js <destinataire> [hote] [port]');
    process.exit(1);
}

// Saisie masquee. readline affiche normalement ce qui est tape ; on remplace
// sa sortie par un filtre qui laisse passer l'invite et rien d'autre.
function demanderMotDePasse(invite) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        let afficher = true;
        rl._writeToOutput = function (texte) {
            if (afficher && texte.indexOf(invite) === 0) { rl.output.write(texte); return; }
            if (texte === '\r\n' || texte === '\n') { rl.output.write(texte); }
        };
        rl.question(invite, (reponse) => { afficher = false; rl.close(); resolve(reponse); });
    });
}

// Un jeu de donnees realiste : un chauffeur en course, de nuit, a Bordeaux.
const EXEMPLE = {
    alerte: {
        driver: 'exemple', destinataire: 'secours', numero: '112', pays: 'FR',
        bookingId: '-ESSAI_PAS_UNE_VRAIE_COURSE', at: Date.now(),
        plateforme: 'android', version: '1.6.4',
    },
    chauffeur: {
        firstName: 'Chauffeur', lastName: '(exemple)',
        mobile: '+33 6 00 00 00 00', email: 'exemple@heeroo.fr',
        vehicleModel: 'Peugeot 508', vehicleNumber: 'AA-000-AA', country: 'FR',
        location: { lat: 44.8412, lng: -0.5800, add: '1 place de la Bourse, 33000 Bordeaux' },
    },
    course: {
        customer_name: 'Passager (exemple)', customer_contact: '+33 6 00 00 00 01',
        pickupAddress: '1 place de la Bourse, 33000 Bordeaux',
        dropAddress: 'Aeroport de Bordeaux-Merignac',
        status: 'STARTED',
    },
};

(async () => {
    console.log('Serveur      : ' + hote + ':' + port + ' (SSL/TLS)');
    console.log('Identifiant  : ' + utilisateur);
    console.log('Destinataire : ' + destinataire);
    console.log();

    const motDePasse = await demanderMotDePasse('Mot de passe de ' + utilisateur + ' (invisible) : ');
    if (!motDePasse) { console.error('\nAucun mot de passe saisi.'); process.exit(1); }

    const { sujet, texte, html } = composerCourriel(EXEMPLE);

    const transport = nodemailer.createTransport({
        host: hote, port: port, secure: port === 465,
        auth: { user: utilisateur, pass: motDePasse },
    });

    try {
        console.log('\nConnexion au serveur...');
        await transport.verify();
        console.log('  ok  le serveur accepte ces identifiants.');
    } catch (erreur) {
        console.error('\n  ECHEC a la connexion : ' + erreur.message);
        console.error('\n  Pistes : le nom du serveur (Emails > Action > Parametres de');
        console.error('  configuration dans l espace LWS), le port 465, ou le mot de passe.');
        process.exit(1);
    }

    try {
        const info = await transport.sendMail({
            from: 'Heeroo SOS <' + utilisateur + '>',
            to: destinataire,
            subject: '[ESSAI] ' + sujet,
            text: 'CECI EST UN ESSAI, aucun chauffeur n a appele.\n'
                + '----------------------------------------------------------\n\n' + texte,
            html: '<p style="background:#fffbe6;padding:8px;border:1px solid #e0c060">'
                + '<strong>CECI EST UN ESSAI</strong> — aucun chauffeur n a appele.</p>' + html,
        });
        console.log('  ok  message accepte par le serveur.');
        console.log('      identifiant : ' + (info.messageId || '(aucun)'));
        console.log('\nVerifiez la boite ' + destinataire + '. Le sujet commence par [ESSAI].');
        console.log('Regardez aussi les indesirables : c est le premier message envoye');
        console.log('par ce compte depuis un programme.');
    } catch (erreur) {
        console.error('\n  ECHEC a l envoi : ' + erreur.message);
        process.exit(1);
    }
})();
