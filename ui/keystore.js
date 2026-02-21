// keystore.js
// Handles secure storage of the user's AES-256-GCM encryption key using IndexedDB.
// The key is never sent to the server after initial exchange.

const DB_NAME = 'FiresideKeystore';
const STORE_NAME = 'keys';
const KEY_ID = 'user_encryption_key';

function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveKey(base64Key) {
    if (!base64Key) return;

    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(base64Key, KEY_ID);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getKey() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(KEY_ID);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function clearKey() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(KEY_ID);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
