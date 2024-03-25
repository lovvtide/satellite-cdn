import { DeleteObjectCommand } from '@aws-sdk/client-s3';

import R2Client from './R2Client.js';

export default async (req, res) => {
	try {
		if (req.blossom.verb !== 'delete') {
			throw { code: 401, message: "Expected t tag value 'delete'" };
		}

		let sha256;

		for (let tag of req.blossom.auth.tags) {
			if (tag[0] === 'x') {
				sha256 = tag[1];
				break;
			}
		}

		if (!sha256) {
			throw { code: 401, message: 'Missing x tag' };
		}

		// Delete record of blob, owned by given pubkey
		const deleted = req.app.db.deleteBlob(sha256, {
			pubkey: req.blossom.auth.pubkey,
		});

		if (deleted) {
			const client = R2Client();

			const deleteResponse = await client.send(
				new DeleteObjectCommand({
					Bucket: process.env.S3_BUCKET,
					Key: sha256,
				}),
			);
		}

		res.send();
	} catch (err) {
		console.log(err);
		res
			.status(err.code || 500)
			.json({ message: err.message || 'Unknown Error' });
	}
};
