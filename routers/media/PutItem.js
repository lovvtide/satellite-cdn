import { CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { fileTypeFromStream } from 'file-type';
import { PassThrough } from 'stream';
import { encode } from 'magnet-uri';
import createTorrent from 'create-torrent';
import parseTorrent from 'parse-torrent';
import sanitize from 'sanitize-filename';
import mimeTypes from 'mime-types';
import crypto from 'crypto';
import OS from 'os';
import fs from 'fs';

import ValidateUploadAttempt from '../../database/functions/ValidateUploadAttempt.js';
import CreateFile from '../../database/functions/CreateFile.js';
import R2Client from './R2Client.js';


const ComputeTorrentInfo = (input, options = {}) => {

	return new Promise((resolve, reject) => {

		createTorrent(input, options, async (err, torrentFile) => {

			if (!err) {

				let parsed;

				try {
					parsed = await parseTorrent(torrentFile);
				} catch (err) {
					reject(err);
				}

				if (!parsed) {
					reject();
				}

				resolve({
					magnet: encode(parsed),
					infohash: parsed.infoHash,
					size: parsed.length
				});

			} else {
				reject(err);
			}
		});
	});
};


export default async (req, res) => {

	let client, tempName, tempPath, constrainSize, customLabel;

	try {

		const { auth } = req;

		if (auth.content !== 'Authorize Upload') {
			throw { code: 403 };
		}

		if (Math.abs(auth.created_at - Math.ceil(Date.now() / 1000)) > (60 * 10 * 5)) {
			throw { code: 403 };
		}

		const validUpload = await ValidateUploadAttempt(auth);

		if (!validUpload) {
			throw { code: 403 };
		}

		//const { timeRemaining } = await GetMediaAccount(auth.pubkey);

		if (timeRemaining !== Infinity && timeRemaining <= 0) {
			throw { code: 402 };
		}

		tempName = `${crypto.randomBytes(20).toString('hex')}.temp`;
		tempPath = `${OS.homedir()}/temp/${tempName}`;

		// Writable stream to save the file to disk
		const fileStream = fs.createWriteStream(tempPath);

		// Stream to get the hash of the stream
		const hash = crypto.createHash('sha256').setEncoding('hex');

		// Pass through stream to split request readable stream
		const passThrough = new PassThrough();

		// Complettion flags
		let savedLocal, sha256;

		fileStream.on('finish', () => {
		  //console.log('File saved on disk');
		  savedLocal = true;
		});

		hash.on('finish', () => {
			//console.log('hash finished');
			hash.end();
			sha256 = hash.read();
		});

		// Setup the pass through stream to write the file
		// to disk and compute sha256 hash simultaneously
		passThrough.pipe(fileStream);
		passThrough.pipe(hash);

		// Create interface to object storage
		client = R2Client();

		// Initiate upload
		const uploading = new Upload({
			client,
			params: {
				Bucket: process.env.S3_BUCKET,
				Body: passThrough,
				Key: tempName
			}
		});

		// Log upload progress (TODO disable for prod)
		uploading.on('httpUploadProgress', (progress) => {
			//console.log('upload prog', progress);

			// TODO sum up values as they are reported so
			// if the total file size exceeds 5GB throw
			// an error

		});

		// Pipe the request body to the passthrough stream
		req.pipe(passThrough);

		// Await confirmation that the upload completed
		const resp = await uploading.done();

		// Ensure that hash was computed and local file created
		if (!sha256 && savedLocal) {
			throw { code: 500 };
		}

		// Check for indicated constraints
		for (let tag of auth.tags) {

			if (tag[0] === 'size') {

				constrainSize = parseInt(tag[1]);

			} else if (tag[0] === 'label') {

				customLabel = String(tag[1]);
			}
		}

		// If size is constrained, check value
		if (typeof constrainSize !== 'undefined') {

			const stat = fs.statSync(tempPath);

			if (stat.size !== constrainSize) {
				throw { code: 400 };
			}
		}

		// Get a read stream to the newly created temp file
		const readLocal = await fs.createReadStream(tempPath);

		// Determine the mimetype and file ext
		const fileInfo = await fileTypeFromStream(readLocal);

		let mime, name, ext;

		for (let tag of auth.tags) {
			if (tag[0] === 'name' && typeof tag[1] === 'string') {
				name = sanitize(tag[1]);
				break;
			}
		}

		if (fileInfo) {

			mime = fileInfo.mime;

			if (fileInfo.ext) { // Use detected ext if it exists

				ext = fileInfo.ext;

			}
		}

		if (!ext && name && name.indexOf('.') !== -1) {

			const parsedext = name.slice(name.lastIndexOf('.') + 1);

			if (parsedext) {

				ext = parsedext;
			}
		}

		// If mime type not found, try to
		// infer it from file extension
		if (!mime) {

			let inferred;

			if (ext) {

				inferred = mimeTypes.lookup(ext);
			}

			mime = inferred || 'application/octet-stream';
		}

		// Get the name of the file (hash + ext)
		const key = ext ? `${sha256}.${ext}` : sha256;

		const copyParams = {
			CopySource: `/${process.env.S3_BUCKET}/${tempName}`,
			Bucket: process.env.S3_BUCKET,
			MetadataDirective: 'REPLACE',
			ContentType: mime,
			Key: key
		};

		/*

		// Types of files for which to omit the content disposition header
		const inlineTypes = [ 'image', 'video', 'audio' ];

		if (name && inlineTypes.indexOf(mime.split('/')[0]) === -1) {

			// TODO maybe add ContentDisposition header to copy params
		}

		*/

		const resolved = await Promise.all([
			ComputeTorrentInfo(tempPath, { name }),
			client.send(new CopyObjectCommand(copyParams))
		]);

		const { infohash, size, magnet } = resolved[0];

		const url = `${process.env.CDN_ENDPOINT}/${key}`;

		const record = await CreateFile({
			pubkey: auth.pubkey,
			upload: auth.id,
			customLabel,
			sha256,
			infohash,
			magnet,
			name,
			mime,
			size,
			ext
		});

		const nip94 = [
			[ 'x', sha256 ],
			[ 'm', mime ],
			[ 'i', infohash ],
			[ 'url', url ],
			[ 'size', String(size) ],
			[ 'magnet', magnet ]
		];

		if (name) {

			nip94.push([ 'name', name ]);
		}

		res.json({
			created: record.created,
			sha256,
			name,
			url,
			infohash,
			magnet,
			size,
			type: mime,
			nip94,
			label: customLabel
		});

	} catch (err) {
		console.log(err);
		res.status(err.code || 500).send(err.message || 'Unknown Error');
	}

	try { // Cleanup temp local file

		if (tempPath) {

			await new Promise((resolve, reject) => {
				fs.unlink(tempPath, (err) => {
					if (err) {
						reject(err)
					} else {
						resolve();
					}
				});
			});
		}

	} catch (err) {

		console.log('error cleaning up temp local', err);
	}

	try { // Cleanup temp remote file

		if (tempName) {

			const deleteResponse = await client.send(new DeleteObjectCommand({
				Bucket: process.env.S3_BUCKET,
				Key: tempName
			}));
		}

	} catch (err) {

		console.log('error cleaning up temp remote', err);
	}

};
