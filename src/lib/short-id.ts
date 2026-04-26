const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 8;

// 62 doesn't divide 256 evenly, so byte-mod-62 has a tiny bias (chars in
// 0..255-mod-62's residue overlap appear ~1.6% more often). For an opaque
// URL slug at 62^8 ≈ 2.18 × 10^14 entropy this is irrelevant; reject-sampling
// would only matter for cryptographic uniqueness and we already collision-retry
// at the DB layer.
export function generateShortId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
	let out = "";
	for (let i = 0; i < ID_LENGTH; i++) {
		out += ALPHABET[bytes[i] % 62];
	}
	return out;
}
