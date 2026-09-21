import React, { useEffect, useState } from 'react';
import { storageRef } from '../config/firebase';

// Image d'un document stocké sur Firebase Storage.
//
// Les documents des chauffeurs ne sont plus publics : une URL enregistrée sans
// jeton (`…?alt=media` sans `&token=`) ne s'affiche plus dans un <img>. Pour ces
// URL, on demande au SDK une URL de téléchargement signée (getDownloadURL),
// que les règles de stockage accordent aux administrateurs ; le navigateur
// charge ensuite l'image normalement. Les URL déjà signées passent telles quelles.

const STORAGE_HOST = 'https://firebasestorage.googleapis.com/';

function needsSignedUrl(src) {
  return typeof src === 'string' && src.startsWith(STORAGE_HOST) && !/[?&]token=/.test(src);
}

/** Chemin de l'objet (« users/xxx ») à partir d'une URL firebasestorage. */
function objectPath(src) {
  const match = src.match(/\/o\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const cache = new Map();

export default function SecureImage({ src, alt, style, ...rest }) {
  const [url, setUrl] = useState(needsSignedUrl(src) ? cache.get(src) || null : src);
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!needsSignedUrl(src)) { setUrl(src); return undefined; }
    if (cache.has(src)) { setUrl(cache.get(src)); return undefined; }
    const path = objectPath(src);
    if (!path) { setFailed(true); return undefined; }
    storageRef.ref(path).getDownloadURL()
      .then((signed) => { cache.set(src, signed); if (!cancelled) setUrl(signed); })
      .catch((e) => {
        const code = (e && e.code) || '';
        console.warn('[SecureImage] document refusé', path, code, e && e.message);
        if (cancelled) return;
        setReason(code === 'storage/unauthorized' ? 'accès refusé (rôle administrateur non actif : déconnectez-vous puis reconnectez-vous)'
          : code === 'storage/object-not-found' ? 'fichier absent du stockage'
          : code.replace('storage/', '') || 'erreur réseau');
        setFailed(true);
      });
    return () => { cancelled = true; };
  }, [src]);

  if (failed) {
    return <span title={reason} style={{ display: 'inline-block', width: 100, fontSize: 11, color: '#b00' }}>Document inaccessible — {reason}</span>;
  }
  if (!url) {
    return <span style={{ display: 'inline-block', width: 100, height: 60, background: '#f0f0f0', borderRadius: 4 }} />;
  }
  return <img alt={alt} src={url} style={style} {...rest} />;
}
