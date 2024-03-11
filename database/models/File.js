import Mongoose from 'mongoose';


/* Model of NIP-94 file */

const File = new Mongoose.Schema({

/* File Attributes */

	// Pubkey of user who uploaded the file
	pubkey: { type: String, index: true },

	// SHA256 hash of data
	sha256: { type: String, index: true },

	// Torrent infohash
	infohash: { type: String, index: true },

	// MIME type of file, e.g. video/mp4
	mime: { type: String, index: true },

	// Filename, used to compute infohash
	name: { type: String },

	// File size in bytes
	size: { type: Number },

	// Torrent magnet link
	magnet: { type: String },

	// File extention, e.g. mp4
	ext: { type: String },

	// Optional custom label set from upload auth
	label: { type: String },


/* Contextual Info */

	// Timestamp when file was uploaded to object store
	created: { type: Number, index: true },

	// Timestamp when file was removed from object store
	deleted: { type: Number, index: true },

	// Id of upload auth event
	upload: { type: String }
	
});

export default Mongoose.model('File', File);
