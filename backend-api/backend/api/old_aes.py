"""
An AES Cipher that encrypts and decrypts a string. Useful for protecting secrets.

This is an old library that has a vulnerability. We are only keeping it for right now
because some of the old keys are invalid, and we dont want to 'loose' the data even
though it is effectively already lost forever/

Once `scripts/clean_old_aes.py` is run on the production database we can update the
custom sqlalchemy class that utilizies this and remove this code.
"""

import base64
import hashlib
import json

from Crypto import Random  # noqa: S413
from Crypto.Cipher import AES  # noqa: S413

from utilities.config import settings

# Copied from: https://stackoverflow.com/questions/12524994/encrypt-decrypt-using-pycrypto-aes-256


class AESCipher:
    "This class encrypts and decrypts a string using AES."

    def __init__(self, key: str):
        self.bs = AES.block_size
        self.key = hashlib.sha256(key.encode()).digest()

    def encrypt(self, raw: str | None) -> bytes:
        "Encrypts a string. If the value is None, converts it to a blank string."
        clean = raw or ""
        if not isinstance(clean, str):
            raise TypeError("raw value must be a string")
        clean = self._pad(clean)
        iv = Random.new().read(AES.block_size)
        cipher = AES.new(self.key, AES.MODE_CBC, iv)
        return base64.b64encode(iv + cipher.encrypt(clean.encode()))

    def encrypt_dict(self, the_dict: dict) -> bytes:
        "Converts a dictionary into an encrypted bytes object."
        if not isinstance(the_dict, dict):
            raise TypeError("the_dict must be a dict")
        dict_string = json.dumps(the_dict)
        return self.encrypt(dict_string)

    def decrypt(self, enc: bytes) -> str:
        "Decrypts a bytes object into a string."
        enc = base64.b64decode(enc)
        iv = enc[: AES.block_size]
        cipher = AES.new(self.key, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(enc[AES.block_size :])  # noqa: E203
        return self._unpad(decrypted).decode("utf-8")

    def decrypt_dict(self, enc: bytes) -> dict:
        "Decrypts a bytes object into a dictionary."
        dict_string = self.decrypt(enc)
        try:
            return json.loads(dict_string)
        except json.decoder.JSONDecodeError:
            return {}

    def _pad(self, s):
        return s + (self.bs - len(s) % self.bs) * chr(self.bs - len(s) % self.bs)

    @staticmethod
    def _unpad(s: bytes):
        return s[: -ord(s[len(s) - 1 :])]  # noqa: E203


base_cipher = AESCipher(key=settings.OPENBB_AES_KEY)
