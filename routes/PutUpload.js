import { CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { fileTypeFromStream } from 'file-type';
import { PassThrough } from 'stream';
import { encode } from 'magnet-uri';
import createTorrent from 'create-torrent';
import parseTorrent from 'parse-torrent';
import mimeTypes from 'mime-types';
import crypto from 'crypto';
import OS from 'os';
import fs from 'fs';

//import ValidateUploadAttempt from '../../database/functions/ValidateUploadAttempt.js';
import Account from '../database/functions/Account.js';
import CreateFile from '../database/functions/CreateFile.js';
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

	let client, tempName, tempPath, constrainSize;

	try {

		if (req.blossom.verb !== 'upload') {
			throw { code: 401 };
		}

		/*
		const { timeRemaining } = await Account(req.blossom.auth.pubkey);

		if (timeRemaining !== Infinity && timeRemaining <= 0) {
			throw { code: 402 };
		}
		*/

		tempName = `${crypto.randomBytes(20).toString('hex')}.temp`;
		tempPath = `${OS.homedir()}/temp/${tempName}`;

		// Writable stream to save the file to disk
		const fileStream = fs.createWriteStream(tempPath);

		// Stream to get the hash of the stream
		const hash = crypto.createHash('sha256').setEncoding('hex');

		// Pass through stream to split request readable stream
		const passThrough = new PassThrough();

		// Completion flags
		let savedLocal, sha256;

		fileStream.on('finish', () => {
		  savedLocal = true;
		});

		hash.on('finish', () => {
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

		// Pipe the request body to the passthrough stream
		req.pipe(passThrough);

		// Await confirmation that the upload completed
		const resp = await uploading.done();

		// Ensure that hash was computed and local file created
		if (!sha256 && savedLocal) {
			throw { code: 500 };
		}

		// Check for indicated constraints
		for (let tag of req.blossom.auth.tags) {

			if (tag[0] === 'size') {

				if (constrainSize) {
					throw { code: 401 };
				}

				constrainSize = parseInt(tag[1]);
			}
		}

		const stat = fs.statSync(tempPath);

		if (stat.size !== constrainSize) {
			throw { code: 401 };
		}

		// Get a read stream to the newly created temp file
		const readLocal = await fs.createReadStream(tempPath);

		// Determine the mimetype and file ext
		const fileInfo = await fileTypeFromStream(readLocal);

		let mime, ext;

		if (fileInfo) {

			mime = fileInfo.mime;

			if (fileInfo.ext) { // Use detected ext if it exists

				ext = fileInfo.ext;
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

		const copyParams = {
			CopySource: `/${process.env.S3_BUCKET}/${tempName}`,
			Bucket: process.env.S3_BUCKET,
			MetadataDirective: 'REPLACE',
			ContentType: mime,
			Key: sha256
		};

		// Note that the torrent "name" is just the sha256 hash.
		// This is important because the value of the name will
		// effect the infohash, which should be deterministic
		const resolved = await Promise.all([
			ComputeTorrentInfo(tempPath, { name: sha256 }),
			client.send(new CopyObjectCommand(copyParams))
		]);

		const { infohash, size, magnet } = resolved[0];

		const url = `${process.env.CDN_ENDPOINT}/${ext ? `${sha256}.${ext}` : sha256}`;

		const record = await CreateFile({
			pubkey: req.blossom.auth.pubkey,
			sha256,
			infohash,
			magnet,
			mime,
			size,
			ext
		});

		res.json({
			created: record.created,
			infohash,
			type: mime,
			sha256,
			size,
			url
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
