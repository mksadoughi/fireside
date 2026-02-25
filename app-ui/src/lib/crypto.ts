// AES-256-GCM encryption/decryption via WebCrypto API

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

async function importKey(base64Key: string): Promise<CryptoKey> {
  const keyBytes = base64ToUint8Array(base64Key);
  return crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(
  base64Key: string,
  plaintext: string
): Promise<{ ciphertextB64: string; ivB64: string }> {
  const key = await importKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return {
    ciphertextB64: uint8ArrayToBase64(new Uint8Array(ciphertext)),
    ivB64: uint8ArrayToBase64(iv),
  };
}

export async function decryptMessage(
  base64Key: string,
  ivB64: string,
  ciphertextB64: string
): Promise<string> {
  const key = await importKey(base64Key);
  const iv = base64ToUint8Array(ivB64);
  const ciphertext = base64ToUint8Array(ciphertextB64);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "[Error: Decryption Failed]";
  }
}
