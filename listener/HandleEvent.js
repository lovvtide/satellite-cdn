import HandleZapReceipt from './HandleZapReceipt.js';

// Pass received event to relevant handler(s)
export default async (app, event) => {
	try {
		switch (event.kind) {
			case 9735:
				await HandleZapReceipt(app, event);
				break;

			default:
				break;
		}
	} catch (err) {
		console.log(err);
	}
};
