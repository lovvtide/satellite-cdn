import express from 'express';

import Auth from './Auth.js';
import GetAccount from './GetAccount.js';
import GetCredit from './GetCredit.js';
import GetItem from './GetItem.js';
import GetList from './GetList.js';
import PutUpload from './PutUpload.js';
import DeleteItem from './DeleteItem.js';


export default () => {

	const router = express.Router();

	// Get user account
	router.get('/account', Auth, GetAccount);

	// Buy storage credit
	router.get('/account/credit', Auth, GetCredit);

	// Redirect to object storage
	router.get('/:id', GetItem);

	// List all files for one pubkey
	router.get('/list/:pubkey', Auth, GetList);

	// Add a file
	router.put('/upload', Auth, PutUpload);

	// Remove a file
	router.delete('/:hash', Auth, DeleteItem);

	// Return 400 for unknown api routes
	router.get('*', (req, res) => {
		res.status(404).send();
	});

	return router;
};
