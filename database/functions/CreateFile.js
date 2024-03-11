import File from '../models/File.js';


export default async (params) => {

	const set = {
		upload: params.upload,
		created: Math.floor(Date.now() / 1000),
		infohash: params.infohash,
		magnet: params.magnet,
		name: params.name
	};

	// Optionally set custom label
	if (typeof params.customLabel !== 'undefined') {

		set.label = params.customLabel;
	}

	// Insert the event and check for existing
	return await File.findOneAndUpdate({
		pubkey: params.pubkey,
		sha256: params.sha256
	}, {
		$setOnInsert: {
			mime: params.mime,
			size: params.size,
			ext: params.ext
		},
		$set: set,
		$unset: {
			deleted: 0
		}
	}, {
		upsert: true,
		new: true
	}).lean();

};