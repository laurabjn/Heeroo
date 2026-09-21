import React, { useEffect, useState } from 'react';
import { authRef } from '../config/firebase';

// Image d'un document stocké sur Firebase Storage.
//
// Les documents des chauffeurs ne sont plus publics : une URL sans jeton
// (`…?alt=media` sans `&token=`) renvoie 403 dans un <img> ordinaire. On
// télécharge alors le fichier avec la session de l'administrateur (en-tête
// Authorization, autorisé par les règles de stockage pour les comptes admin)
// et on affiche le résultat. Les URL avec jeton sont affichées directement.

const STORAGE_HOST = 'https://firebasestorage.googleapis.com/';

function needsAuth(src) {
  return typeof src === 'string' && src.startsWith(STORAGE_HOST) && !/[?&]token=/.test(src);
}

const cache = new Map();

async function fetchWithSession(src, forceRefresh) {
  const user = authRef.currentUser;
  if (!user) throw new Error('non connecté');
  const idToken = await user.getIdToken(forceRefresh);
  const response = await fetch(src, { headers: { Authorization: 'Firebase ' + idToken } });
  if (!response.ok) throw Object.assign(new Error('HTTP ' + response.status), { status: response.status });
  return URL.createObjectURL(await response.blob());
}

export default function SecureImage({ src, alt, style, ...rest }) {
  const [url, setUrl] = useState(needsAuth(src) ? cache.get(src) || null : src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!needsAuth(src)) { setUrl(src); return undefined; }
    if (cache.has(src)) { setUrl(cache.get(src)); return undefined; }
    (async () => {
      try {
        let blobUrl;
        try {
          blobUrl = await fetchWithSession(src, false);
        } catch (e) {
          // Jeton sans badge admin (connexion antérieure au badge) : on le rafraîchit une fois.
          if (e.status === 403) blobUrl = await fetchWithSession(src, true);
          else throw e;
        }
        cache.set(src, blobUrl);
        if (!cancelled) setUrl(blobUrl);
      } catch (e) {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [src]);

  if (failed) {
    return <span title={alt} style={{ display: 'inline-block', width: 100, fontSize: 11, color: '#999' }}>Document inaccessible</span>;
  }
  if (!url) {
    return <span style={{ display: 'inline-block', width: 100, height: 60, background: '#f0f0f0', borderRadius: 4 }} />;
  }
  return <img alt={alt} src={url} style={style} {...rest} />;
}
