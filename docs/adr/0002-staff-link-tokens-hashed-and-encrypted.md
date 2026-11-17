# Staff Link tokens are stored as a SHA-256 hash for lookup plus an AES-256-GCM encrypted copy

Each Staff Member has one stable Staff Link, so it has to go in every Publish and Send Updates email, and the Owner has to be able to copy it. That isn't possible if only a hash is stored. So the token (random, at least 32 bytes) is stored twice: as a **SHA-256 hash**, the only thing used to look it up, and as an **AES-256-GCM ciphertext** (key from an environment variable, never in the database) that is decrypted only to build an email or to show the link to an authenticated Owner of that Venue. Regenerating replaces both columns, which revokes the old link. **This knowingly relaxes the original "stored only as hashes" rule**: a database leak on its own still exposes no usable links, but the database together with the env key does.

## Considered Options

- **Hash only, new link on every Publish, old links valid until they expire**: true hash-only storage, but staff collect a pile of links, and the Owner can never show a staff member "your link". Rejected.
- **Hash only, one live link, rotated whenever it's re-sent**: every email kills the previous one, so a staff member who opens last week's email gets a dead link. Rejected.
- **Hash only, permanent link emailed only when the staff member is created**: Publish emails couldn't contain the link, which defeats the point of emailing. Rejected.
- **Plaintext token**: a database read alone would expose every link. Rejected.

## Consequences

Losing the encryption key makes the stored links unrecoverable (fix: regenerate all of them). Rotating the key means re-encrypting the stored tokens. Lookups never decrypt anything: hash the incoming token and compare.
