import EventEmitter from 'events';
import Sqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

class Database extends EventEmitter {
	constructor(config = {}) {
		super();

		this.config = {
			name: 'cdn',
			...config,
		};

		this.path = {
			main: path.join(this.config.directory, `${this.config.name}.db`),
			shm: path.join(this.config.directory, `${this.config.name}.db-shm`),
			wal: path.join(this.config.directory, `${this.config.name}.db-wal`),
		};

		// Detect architecture to pass the correct native sqlite module
		this.db = new Sqlite3(this.path.main, {
			// Optionally use native bindings indicated by environment
			nativeBinding: process.env.NATIVE_BINDINGS_PATH
				? path.join(
						process.env.NATIVE_BINDINGS_PATH,
						`${process.arch === 'arm64' ? 'arm64' : 'x64'}/better_sqlite3.node`,
					)
				: undefined,
		});

		if (config.wal !== false) {
			this.db.pragma('journal_mode = WAL');
		}

		this.db.transaction(() => {
			// Create blobs table
			this.db
				.prepare(
					`
				CREATE TABLE IF NOT EXISTS blobs (
					sha256 TEXT(64) PRIMARY KEY,
					type TEXT,
					ext TEXT,
					size INTEGER,
					created INTEGER
				)
			`,
				)
				.run();

			// Create owners table
			this.db
				.prepare(
					`
				CREATE TABLE IF NOT EXISTS owners (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					blob TEXT(64) REFERENCES blobs(sha256),
					pubkey TEXT(64)
				)
			`,
				)
				.run();

			// Create credits table
			this.db
				.prepare(
					`
				CREATE TABLE IF NOT EXISTS credits (
					id TEXT(64) PRIMARY KEY,
					pubkey TEXT(64),
					offer TEXT,
					created INTEGER,
					gb_months INTEGER,
					rate_usd INTEGER,
					receipt TEXT,
					paid_at INTEGER,
					paid_by INTEGER
				)
			`,
				)
				.run();

			// Create indices
			const indices = [
				this.db.prepare(
					'CREATE INDEX IF NOT EXISTS idx_sha256 ON blobs(sha256)',
				),
				this.db.prepare(
					'CREATE INDEX IF NOT EXISTS idx_created_at ON blobs(created)',
				),
				this.db.prepare('CREATE INDEX IF NOT EXISTS idx_blob ON owners(blob)'),
				this.db.prepare(
					'CREATE INDEX IF NOT EXISTS idx_pubkey ON owners(pubkey)',
				),
				this.db.prepare('CREATE INDEX IF NOT EXISTS idx_id ON credits(id)'),
				this.db.prepare(
					'CREATE INDEX IF NOT EXISTS idx_pubkey ON credits(pubkey)',
				),
			];

			indices.forEach((statement) => statement.run());
		})();
	}

	getAccount(pubkey) {
		const credits = this.db
			.prepare(
				`
			SELECT credits.id, credits.pubkey, credits.offer, credits.created, credits.gb_months, credits.rate_usd, credits.receipt, credits.paid_at, credits.paid_by FROM credits
			WHERE pubkey = ? AND paid_at IS NOT NULL
		`,
			)
			.all([pubkey]);

		const files = this.listBlobs(pubkey);

		// Total amount currently stored in bytes
		const storageTotal = files.reduce((bytes, file) => {
			//return bytes + (file.deleted ? 0 : file.size);
			return file.size;
		}, 0);

		// Total credit in GB months
		const creditTotal = credits.reduce((gb_months, credit) => {
			return gb_months + credit.gb_months;
		}, 0);

		const now = Math.floor(Date.now() / 1000);

		// Total usage in GB months
		const usageTotal = files.reduce((usage, file) => {
			const age_months = (now - file.created) / (30 * 86400);
			const size_gb = file.size / 1000000000;
			return usage + size_gb * age_months;
		}, 0);

		const timeRemaining =
			creditTotal > usageTotal
				? ((creditTotal - usageTotal) * 30 * 86400) /
					(storageTotal / 1000000000)
				: 0;

		return {
			storageTotal,
			creditTotal,
			usageTotal,
			timeRemaining,
			paidThrough: now + Math.floor(timeRemaining),
			transactions: credits.map((credit) => {
				const tx = {
					order: JSON.parse(credit.offer),
					receipt: JSON.parse(credit.receipt),
				};

				for (let tag of tx.receipt.tags) {
					if (tag[0] === 'description') {
						tx.payment = JSON.parse(tag[1]);
						break;
					}
				}

				return tx;
			}),
			files: files.map((file) => {
				return {
					created: file.created,
					sha256: file.sha256,
					size: file.size,
					type: file.type,
					name: `${file.sha256}${file.ext ? `.${file.ext}` : ''}`,
					url: `${process.env.CDN_ENDPOINT}/${file.sha256}${file.ext ? `.${file.ext}` : ''}`,
				};
			}),
		};
	}

	createBlob(params) {
		return this.db.transaction(() => {
			const created = Math.floor(Date.now() / 1000);

			this.db
				.prepare(
					`
				INSERT OR IGNORE INTO blobs (sha256, type, ext, size, created)
				VALUES (?, ?, ?, ?, ?)
			`,
				)
				.run([params.sha256, params.type, params.ext, params.size, created]);

			this.db
				.prepare(
					`
				INSERT OR IGNORE INTO owners (blob, pubkey)
				VALUES (?, ?)
			`,
				)
				.run([params.sha256, params.pubkey]);

			return {
				sha256: params.sha256,
				type: params.type,
				ext: params.ext,
				size: params.size,
				created,
			};
		})();
	}

	createCredit(params) {
		this.db
			.prepare(
				`
			INSERT OR IGNORE INTO credits (id, pubkey, offer, created, gb_months, rate_usd)
			VALUES (?, ?, ?, ?, ?, ?)
		`,
			)
			.run([
				params.id,
				params.pubkey,
				JSON.stringify(params.offer),
				params.created,
				params.gb_months,
				params.rate_usd * 100,
			]);
	}

	handlePayment(params) {
		this.db
			.prepare(
				`
		    UPDATE credits 
		    SET receipt = ?, paid_at = ?, paid_by = ?
		    WHERE id = ?`,
			)
			.run([params.receipt, params.paid_at, params.paid_by, params.id]);

		return;
	}

	getBlob(sha256) {
		return (
			this.db
				.prepare(
					`
			SELECT * FROM blobs
			WHERE sha256 = ?
		`,
				)
				.all([sha256])[0] || null
		);
	}

	deleteBlob(sha256, constraint = {}) {
		return this.db.transaction(() => {
			let preserve;

			if (constraint.pubkey) {
				// Remove record or pubkey owning blob
				this.db
					.prepare(
						`
					DELETE FROM owners
					WHERE blob = ? AND pubkey = ?
				`,
					)
					.run([sha256, constraint.pubkey]);

				// Check if there are any remaining owners
				const owners = this.db
					.prepare(
						`
					SELECT owners.blob FROM owners
					WHERE blob = ?
				`,
					)
					.all([sha256]);

				// If there are no remaming owners
				// flag blob itself for deletion
				preserve = owners.length > 0;
			}

			if (!preserve) {
				this.db
					.prepare(
						`
					DELETE FROM blobs
					WHERE sha256 = ?
				`,
					)
					.run([sha256]);

				return true; // Indicate blob deleted
			}

			return false;
		})();
	}

	listBlobs(pubkey) {
		return this.db
			.prepare(
				`
			SELECT blobs.sha256, blobs.type, blobs.ext, blobs.size, blobs.created FROM blobs
			INNER JOIN owners ON blobs.sha256 = owners.blob
			WHERE pubkey = ?
		`,
			)
			.all([pubkey]);

		// TODO sort list
	}

	// TODO move this function elsewhere
	async getExchangeRate() {
		// Don't check the exchange rate more than once every 5 mins
		const EXCHANGE_RATE_MAX_AGE = 300;

		const now = Math.floor(Date.now() / 1000);

		// If not found or stale, fetch new data
		if (!this.xr || now - this.xr.at > EXCHANGE_RATE_MAX_AGE) {
			// Yes, this endpoint is hardcoded for now. That would be great if exchange
			// rate apis were standardized wouldn't it? Maybe someone can make a DVM...
			const resp = await axios.get(
				'https://api.coinbase.com/v2/exchange-rates?currency=BTC',
			);

			this.xr = {
				rate: 1 / (resp.data.data.rates.USD * 0.00000001),
				at: now,
			};
		}

		return this.xr.rate;
	}
}

export default Database;
