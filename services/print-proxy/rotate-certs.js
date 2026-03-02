import { generateKeyPairSync, createSign, randomBytes } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.join(__dirname, "certs");
mkdirSync(certDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

// Self-signed X.509 cert — 30-day validity, CN=localhost, SAN=localhost+127.0.0.1
const notBefore = new Date();
const notAfter = new Date(notBefore.getTime() + 30 * 24 * 60 * 60 * 1000);

// DER-encode a minimal self-signed certificate
const serial = randomBytes(8);
const issuer = Buffer.from("3114301206035504030c0b6c6f63616c686f7374", "hex"); // CN=localhost

function derLength(len) {
  if (len < 128) return Buffer.from([len]);
  if (len < 256) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function derSequence(...items) {
  const body = Buffer.concat(items);
  return Buffer.concat([Buffer.from([0x30]), derLength(body.length), body]);
}

function derSet(...items) {
  const body = Buffer.concat(items);
  return Buffer.concat([Buffer.from([0x31]), derLength(body.length), body]);
}

function derOid(oid) {
  const parts = oid.split(".").map(Number);
  const bytes = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    if (v >= 128) {
      const enc = [];
      enc.push(v & 0x7f);
      v >>= 7;
      while (v > 0) { enc.push(0x80 | (v & 0x7f)); v >>= 7; }
      bytes.push(...enc.reverse());
    } else {
      bytes.push(v);
    }
  }
  return Buffer.concat([Buffer.from([0x06, bytes.length]), Buffer.from(bytes)]);
}

function derUtf8(str) {
  const buf = Buffer.from(str, "utf8");
  return Buffer.concat([Buffer.from([0x0c]), derLength(buf.length), buf]);
}

function derInteger(buf) {
  // Ensure positive (prepend 0x00 if high bit set)
  if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0x00]), buf]);
  return Buffer.concat([Buffer.from([0x02]), derLength(buf.length), buf]);
}

function derBitString(buf) {
  const wrapped = Buffer.concat([Buffer.from([0x00]), buf]); // 0 unused bits
  return Buffer.concat([Buffer.from([0x03]), derLength(wrapped.length), wrapped]);
}

function derGeneralizedTime(date) {
  const s = date.toISOString().replace(/[-:T]/g, "").slice(0, 14) + "Z";
  return Buffer.concat([Buffer.from([0x18, s.length]), Buffer.from(s)]);
}

function derExplicit(tag, content) {
  return Buffer.concat([Buffer.from([0xa0 | tag]), derLength(content.length), content]);
}

function derOctetString(buf) {
  return Buffer.concat([Buffer.from([0x04]), derLength(buf.length), buf]);
}

// Subject Alternative Name extension: DNS:localhost, IP:127.0.0.1
const sanDns = Buffer.concat([Buffer.from([0x82]), derLength(9), Buffer.from("localhost")]);
const sanIp = Buffer.concat([Buffer.from([0x87, 4, 127, 0, 0, 1])]);
const sanValue = derSequence(sanDns, sanIp);
const sanExtension = derSequence(
  derOid("2.5.29.17"), // subjectAltName OID
  derOctetString(sanValue)
);
const extensions = derExplicit(3, derSequence(sanExtension));

// Export the public key in DER format
const pubDer = publicKey.export({ type: "spki", format: "der" });

const cn = derSequence(derOid("2.5.4.3"), derUtf8("localhost"));
const rdnSequence = derSequence(derSet(cn));

const version = derExplicit(0, derInteger(Buffer.from([0x02]))); // v3
const serialNumber = derInteger(serial);
const sigAlg = derSequence(derOid("1.2.840.113549.1.1.11"), Buffer.from([0x05, 0x00])); // SHA256withRSA
const validity = derSequence(derGeneralizedTime(notBefore), derGeneralizedTime(notAfter));

const tbs = derSequence(version, serialNumber, sigAlg, rdnSequence, validity, rdnSequence, pubDer, extensions);

const sign = createSign("SHA256");
sign.update(tbs);
const signature = sign.sign(privateKey);

const cert = derSequence(tbs, sigAlg, derBitString(signature));

// Write PEM files
const keyPem = privateKey.export({ type: "pkcs8", format: "pem" });
const certPem = `-----BEGIN CERTIFICATE-----\n${cert.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;

writeFileSync(path.join(certDir, "server.key"), keyPem);
writeFileSync(path.join(certDir, "server.crt"), certPem);

console.log(`Certs written to ${certDir}`);
console.log(`  Valid: ${notBefore.toISOString()} → ${notAfter.toISOString()}`);
