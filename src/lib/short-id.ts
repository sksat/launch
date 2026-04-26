const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 8;

// 62 doesn't divide 256 evenly (256 = 4×62 + 8), so the first 8 chars of
// ALPHABET get 5 byte-values mapping to them and the rest get 4 — i.e. chars
// 0..7 are picked ~25% more often than chars 8..61 (5/4 ratio). For an opaque
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
