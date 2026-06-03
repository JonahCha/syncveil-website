from __future__ import annotations

from app.core.security import decrypt_bytes, encrypt_bytes, hash_password, verify_password


def test_aes_gcm_round_trip():
    nonce, ciphertext = encrypt_bytes(b"top secret file contents")
    assert decrypt_bytes(nonce, ciphertext) == b"top secret file contents"


def test_argon2id_password_hashing():
    hashed = hash_password("SuperSecurePassword123!")
    assert verify_password(hashed, "SuperSecurePassword123!")
    assert not verify_password(hashed, "incorrect")

