// Sonnerie de nouvelle demande de course.
//
// Le chauffeur conduit : une notification silencieuse ne sert à rien. Le
// carillon retentit au volume maximum, et s'entend même si le téléphone est en
// mode silencieux ou vibreur (playsInSilentMode).
//
// Il sonne trois fois, espacées de deux secondes, puis se tait — un compromis
// entre la sonnerie unique, qu'un chauffeur peut manquer téléphone en poche ou
// autoradio fort, et la boucle sans fin, qui dérange au volant. Il s'arrête
// immédiatement dès que la demande n'attend plus de réponse.
//
// Un seul lecteur pour toute l'application : appeler plusieurs fois
// setRideAlert n'empile pas les sonneries.
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const RINGTONE = require('../../assets/sounds/carillon.wav');

const REPEATS = 3;      // nombre total de sonneries
const RING_MS = 3200;   // durée du carillon, arrondie
const GAP_MS = 2000;    // silence entre deux sonneries

let player = null;
let ringing = false;
let repeatsLeft = 0;
let nextTimer = null;

function getPlayer() {
    if (player) return player;
    setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
    }).catch((error) => console.log('[Sonnerie] mode audio refusé', error && error.message));
    player = createAudioPlayer(RINGTONE);
    player.loop = false;
    player.volume = 1;
    return player;
}

function playOnce() {
    const current = getPlayer();
    current.seekTo(0);
    current.play();
}

/** Programme la sonnerie suivante, ou clôt la série. */
function scheduleNext() {
    nextTimer = setTimeout(() => {
        nextTimer = null;
        if (repeatsLeft <= 0) {
            ringing = false;
            return;
        }
        repeatsLeft -= 1;
        try {
            playOnce();
        } catch (error) {
            console.log('[Sonnerie]', error && error.message);
            ringing = false;
            return;
        }
        scheduleNext();
    }, RING_MS + GAP_MS);
}

/** Démarre ou arrête la sonnerie. Sans effet si elle est déjà dans cet état. */
export function setRideAlert(active) {
    try {
        if (active && !ringing) {
            ringing = true;
            repeatsLeft = REPEATS - 1;
            playOnce();
            scheduleNext();
        } else if (!active && ringing) {
            if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
            repeatsLeft = 0;
            player.pause();
            player.seekTo(0);
            ringing = false;
        }
    } catch (error) {
        // Un défaut de la sonnerie ne doit jamais empêcher le chauffeur de voir
        // la demande : on trace et on continue.
        console.log('[Sonnerie]', error && error.message);
        ringing = false;
    }
}

/** À appeler quand l'écran des demandes disparaît. */
export function stopRideAlert() {
    setRideAlert(false);
}
