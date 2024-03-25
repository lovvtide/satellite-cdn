import { verifySignature } from 'nostr-tools';

export default async (app, event) => {
	let amount, offerId, offerTargetPubkey, zapRequest;

	// Only trust zap receipts signed by Satellite's wallet provider
	if (event.pubkey !== process.env.LIGHTNING_PROVIDER_PUBKEY) {
		console.log('Received zap receipt signed by unknown pubkey', event);
		return;
	}

	// Parse the zap request from tags
	for (let tag of event.tags) {
		if (tag[0] === 'description') {
			zapRequest = JSON.parse(tag[1]);
			break;
		}
	}

	if (!zapRequest) {
		console.log('Failed to parse zap request', event);
		return;
	}

	// It's important to verify the zap request, since this
	// was not done automatically when event was received
	if (!verifySignature(zapRequest)) {
		console.log('Failed to verify zap request signature', event);
		return;
	}

	// Parse the "e" and "p" tag values from zap request
	for (let tag of zapRequest.tags) {
		if (tag[0] === 'amount') {
			amount = parseInt(tag[1]);

			if (isNaN(amount) || !isFinite(amount)) {
				console.log('Invalid amount on zap request', event);
				return;
			}
		} else if (tag[0] === 'e') {
			offerId = tag[1];
		} else if (tag[0] === 'p') {
			offerTargetPubkey = tag[1];
		}
	}

	if (!amount) {
		console.log('Failed to parse zapRequest amount', event);
	}

	if (!offerTargetPubkey) {
		console.log('Failed to parse zap request offer id', event);
		return;
	}

	if (offerTargetPubkey !== app.pubkey) {
		console.log('Zap request target public key does not match expected', event);
		return;
	}

	app.db.handlePayment({
		paid_at: event.created_at,
		paid_by: zapRequest.pubkey,
		receipt: JSON.stringify(event),
		id: offerId,
	});
};
