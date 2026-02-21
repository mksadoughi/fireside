package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
)

// EncryptAESGCM encrypts plaintext using AES-256-GCM.
// The key must be exactly 32 bytes for AES-256.
func EncryptAESGCM(key, plaintext []byte) (ciphertext, iv []byte, err error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}

	iv = make([]byte, aesgcm.NonceSize())
	if _, err := rand.Read(iv); err != nil {
		return nil, nil, err
	}

	ciphertext = aesgcm.Seal(nil, iv, plaintext, nil)
	return ciphertext, iv, nil
}

// DecryptAESGCM decrypts ciphertext using AES-256-GCM.
func DecryptAESGCM(key, iv, ciphertext []byte) (plaintext []byte, err error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	plaintext, err = aesgcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}

	return plaintext, nil
}
