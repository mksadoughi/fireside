// crypto.js
// Handles WebCrypto API encryption and decryption for chat messages.

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64) {
    const binary = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Imports a raw base64 key into a WebCrypto CryptoKey object for AES-GCM
async function importKey(base64Key) {
    const keyBytes = base64ToUint8Array(base64Key);
    return await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false, // not extractable
        ["encrypt", "decrypt"]
    );
}

// Encrypts a plaintext string using the provided base64 AES-256 key.
// Returns { ciphertextB64, ivB64 }
export async function encryptMessage(base64Key, plaintext) {
    if (!base64Key) throw new Error("Missing encryption key");

    const key = await importKey(base64Key);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
    const encodedText = new TextEncoder().encode(plaintext);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encodedText
    );

    const ciphertextB64 = uint8ArrayToBase64(new Uint8Array(ciphertextBuffer));
    const ivB64 = uint8ArrayToBase64(iv);

    return { ciphertextB64, ivB64 };
}

// Decrypts a base64 ciphertext using the provided base64 AES-256 key and base64 IV.
// Returns the decoded plaintext string.
export async function decryptMessage(base64Key, ivB64, ciphertextB64) {
    if (!base64Key) throw new Error("Missing encryption key");

    const key = await importKey(base64Key);
    const iv = base64ToUint8Array(ivB64);
    const ciphertext = base64ToUint8Array(ciphertextB64);

    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            ciphertext
        );
        return new TextDecoder().decode(decryptedBuffer);
    } catch (err) {
        console.error("WebCrypto Decryption failed", err);
        return "[Error: Decryption Failed]";
    }
}
