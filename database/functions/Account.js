import StorageCredit from '../models/StorageCredit.js';
import File from '../models/File.js';


export default async (pubkey) => {

	const now = Math.floor(Date.now() / 1000);

	const credits = await StorageCredit.find({
		pubkey,
		paid_at: { $exists: true }
	}).sort({
		paid_at: -1
	}).lean();

	const files = await File.find({
		pubkey
	}).sort({
		created: -1
	}).lean();

	// Total amount currently stored in bytes
	const storageTotal = files.reduce((bytes, file) => {
		return bytes + (file.deleted ? 0 : file.size);
	}, 0);

	// Total credit in GB months
	const creditTotal = credits.reduce((gb_months, credit) => {
		return gb_months + credit.gb_months;
	}, 0);

	// Total usage in GB months
	const usageTotal = files.reduce((usage, file) => {
		const age_months = ((file.deleted ? file.deleted : now) - file.created) / (30 * 86400);
		const size_gb = file.size / 1000000000;
		return usage + (size_gb * age_months);
	}, 0);

	const timeRemaining = creditTotal > usageTotal ? (((creditTotal - usageTotal) * 30 * 86400) / (storageTotal / 1000000000)) : 0;

	return {
		storageTotal,
		creditTotal,
		usageTotal,
		timeRemaining,
		paidThrough: now + Math.floor(timeRemaining),
		transactions: credits.map(credit => {

			const tx = {
				order: JSON.parse(credit.offer),
				receipt: JSON.parse(credit.receipt)
			};

			for (let tag of tx.receipt.tags) {
				if (tag[0] === 'description') {
					tx.payment = JSON.parse(tag[1]);
					break;
				}
			}

			return tx;
		}),
		files: (file => {

			return {
				created: file.created,
				infohash: file.infoHash,
				magnet: file.magnet,
				type: file.mime,
				name: file.name,
				sha256: file.sha256,
				size: file.size,
				url: `${process.env.CDN_ENDPOINT}/${file.sha256}${file.ext ? `.${file.ext}` : ''}`,
				label: file.label
			};
		})
	};
};
