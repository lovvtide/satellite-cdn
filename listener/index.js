import { relayInit } from 'nostr-tools';

export default class Listener {
	constructor(app) {
		// App context
		this.app = app;

		// Connected relays
		this.relays = [];

		// Active subscriptions
		this.pool = {};

		// Event ids detected
		this.seen = {};

		// Event handlers
		this.handlers = {};
	}

	// Connect to a relay
	async connect(url) {
		// Prevent opening duplicate connection
		for (let connected of this.relays) {
			if (connected.url === url) {
				return;
			}
		}

		let relay;

		try {
			relay = relayInit(url);
		} catch (err) {
			console.log(err);
		}

		relay.on('connect', () => {
			clearTimeout(relay._reconnectTimeout);

			relay._encounteredError = false;
			relay._reconnectMillsecs = 500;

			Object.keys(this.pool).forEach((name) => {
				const { connection } = this.pool[name];

				if (!connection[relay.url]) {
					this.subscribe(name, relay);

					console.log('[LISTENING] ' + relay.url);
				}
			});
		});

		relay.on('error', () => {
			Object.keys(this.pool).forEach((name) => {
				const { connection } = this.pool[name];
				connection[relay.url] = null;
			});

			console.log(`[UNREACHABLE] ${relay.url}`);

			relay._encounteredError = true;

			if (relay._pendingReconnect) {
				return;
			}

			if (!relay._reconnectMillsecs) {
				relay._reconnectMillsecs = 500;
			}

			relay._reconnectMillsecs = relay._reconnectMillsecs * 2;

			clearTimeout(relay._reconnectTimeout);

			relay._pendingReconnect = true;

			// Attempt reconnect with an exponential backoff to avoid DDOSing relays
			relay._reconnectTimeout = setTimeout(async () => {
				relay._pendingReconnect = false;

				try {
					await relay.connect();
				} catch (err) {}

				relay._pendingReconnect = false;
			}, relay._reconnectMillsecs);

			console.log(
				relay.url +
					' reconnecting after ' +
					relay._reconnectMillsecs +
					' ms...',
			);
		});

		relay.on('disconnect', async () => {
			if (!relay._encounteredError) {
				Object.keys(this.pool).forEach((name) => {
					const { connection } = this.pool[name];
					connection[relay.url] = null;
				});

				try {
					console.log('[DISCONNECTED] ' + relay.url + ' (reconnecting)');
					await relay.connect();
				} catch (err) {}
			}
		});

		try {
			await relay.connect();
		} catch (err) {
			console.log(err);
		}

		this.relays.push(relay);
	}

	createPool(name, filters = [], options = {}) {
		if (!this.pool[name]) {
			this.pool[name] = {
				connection: {},
				filters,
				options,
			};
		}

		for (let connected of this.relays) {
			this.subscribe(name, connected);
		}
	}

	subscribe(name, relay) {
		const pool = this.pool[name];

		if (!pool) {
			return;
		}

		if (pool.connection[relay.url]) {
			// Active sub

			// Update filters with provided value
			pool.connection[relay.url].req.sub(pool.filters, pool.options);
		} else {
			// Create new sub

			const req = relay.sub(pool.filters, pool.options);

			req.on('event', (event) => {
				this.handlers['event'](this.app, event, relay.url);
			});

			// Add to subscriptions pool
			pool.connection[relay.url] = { req };
		}
	}

	on(name, handler) {
		this.handlers[name] = handler;
	}
}
