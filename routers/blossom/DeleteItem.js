import { DeleteObjectCommand } from '@aws-sdk/client-s3';

import DeleteFile from '../../database/functions/DeleteFile.js';
import QueryFiles from '../../database/functions/QueryFiles.js';
import R2Client from './R2Client.js';


export default async (req, res) => {

	try {

		if (req.blossom.verb !== 'delete') {
			throw { code: 401 };
		}

		let sha256;

		for (let tag of req.blossom.auth.tags) {
			if (tag[0] === 'x') {
				sha256 = tag[1];
				break;
			}
		}

		if (!sha256) {
			throw { code: 401 };
		}

		const deleted = await DeleteFile({
			pubkey: req.blossom.auth.pubkey,
			sha256
		});

		// If any document was modified, look for
		// remaining records with the same hash,
		// if none exist delete from remote
		if (deleted) {

			const remaining = await QueryFiles({
				deleted: { $exists: false },
				sha256
			});

			if (remaining.length === 0) {

				const client = R2Client();

				const deleteResponse = await client.send(new DeleteObjectCommand({
					Bucket: process.env.S3_BUCKET,
					Key: deleted.ext ? `${deleted.sha256}.${deleted.ext}` : deleted.sha256
				}));
			}
		}

		res.send();

	} catch (err) {

		console.log(err);
		res.status(err.code || 500).send(err.message || 'Unknown Error');
	}

};
