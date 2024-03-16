import QueryFiles from '../../database/functions/QueryFiles.js';


export default async (req, res) => {

	try {

		const { auth, verb } = req.blossom;

		if (verb !== 'list') {
			throw { code: 401 };
		}

		// Ensure that a pubkey can only list its own files
		if (req.params.pubkey !== req.blossom.auth.pubkey) {
			throw { code: 401 };
		}

		const files = await QueryFiles({
			pubkey: req.blossom.auth.pubkey
		});

		res.json(files.map(file => {

			return {
				created: file.created,
				infohash: file.infoHash,
				type: file.mime,
				//name: file.name,
				sha256: file.sha256,
				size: file.size,
				url: `${process.env.CDN_ENDPOINT}/${file.sha256}${file.ext ? `.${file.ext}` : ''}`
			};

		}));

	} catch (err) {
		console.log(err);
		res.status(err.code || 500).send(err.message || 'Unknown Error');
	}
};
