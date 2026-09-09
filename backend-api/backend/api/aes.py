"""An AES Cipher that encrypts and decrypts a string. Useful for protecting secrets."""

import base64
import hashlib
import json
import os

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from utilities.config import settings

# Copied from: https://gist.github.com/brysontyrrell/7cebfb05105c25d00e84ed35bd821dfe


class AESCipher:
    "This class encrypts and decrypts a string using AES."

    block_size = 16
    KEY_SIZE = 256

    def __init__(self, key):
        clean_key = hashlib.sha256(key.encode()).digest()
        if len(clean_key) * 8 != self.KEY_SIZE:
            raise ValueError(f"Invalid key size (must be {self.KEY_SIZE} bit)")
        self._key = clean_key

    def _cipher(self, iv) -> Cipher:
        return Cipher(
            algorithms.AES(self._key), modes.CBC(iv), backend=default_backend()
        )

    def encrypt(self, raw) -> bytes:
        clean = raw or ""
        if not isinstance(clean, str):
            raise TypeError("raw value must be a string")
        padded = self._pad(clean).encode()
        iv = os.urandom(self.block_size)
        encryptor = self._cipher(iv).encryptor()
        cipher_text = encryptor.update(padded) + encryptor.finalize()
        return base64.b64encode(cipher_text + iv)

    def encrypt_dict(self, the_dict: dict) -> bytes:
        "Converts a dictionary into an encrypted bytes object."
        if not isinstance(the_dict, dict):
            raise TypeError("the_dict must be a dict")
        dict_string = json.dumps(the_dict)
        return self.encrypt(dict_string)

    def encrypt_list(self, the_list: list) -> bytes:
        "Converts a list containing json serializable objects into an encrypted bytes object."
        if not isinstance(the_list, list):
            raise TypeError(
                "the_list must be a list containing json serializable objects"
            )
        list_string = json.dumps(the_list)
        return self.encrypt(list_string)

    def decrypt(self, encoded: bytes):
        raw = base64.b64decode(encoded)
        cipher_text = raw[: -AESCipher.block_size]
        iv = raw[-AESCipher.block_size :]
        decryptor = self._cipher(iv).decryptor()
        padded = decryptor.update(cipher_text) + decryptor.finalize()
        return self._unpad(padded).decode()

    def decrypt_dict(self, enc: bytes) -> dict:
        "Decrypts a bytes object into a dictionary."
        dict_string = self.decrypt(enc)
        try:
            return json.loads(dict_string)
        except json.decoder.JSONDecodeError:
            return {}

    @staticmethod
    def _pad(raw):
        ordinal = AESCipher.block_size - len(raw) % AESCipher.block_size
        return raw + ordinal * chr(ordinal)

    @staticmethod
    def _unpad(s: bytes):
        return s[: -ord(s[len(s) - 1 :])]  # noqa: E203


base_cipher = AESCipher(key=settings.OPENBB_AES_KEY)
