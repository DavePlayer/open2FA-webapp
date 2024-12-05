import forge from "node-forge";

self.onmessage = async function (e) {
  const { generateKeys } = e.data;

  if (generateKeys) {
    const keys = await generateRsaKeys();
    self.postMessage({ keys });
  }
};

const generateRsaKeys = async () => {
  return new Promise((resolve) => {
    const { publicKey, privateKey } = forge.pki.rsa.generateKeyPair({
      bits: 2048,
      e: 0x10001,
    });

    const publicKeyPem = forge.pki.publicKeyToPem(publicKey);
    console.log("Public Key (PEM):", publicKeyPem);

    const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
    console.log("Private Key (PEM):", privateKeyPem);

    resolve({
      privateKeyPem,
      publicKeyPem,
    });
  });
};
