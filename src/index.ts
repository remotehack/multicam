import { DurableObject } from 'cloudflare:workers';

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */

const pattern = new URLPattern({ pathname: '/:uuid/:action' });

/** A Durable Object's behavior is defined in an exported Javascript class */
export class MyDurableObject extends DurableObject {
	/**
	 * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
	 * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
	 *
	 * @param ctx - The interface for interacting with Durable Object state
	 * @param env - The interface to reference bindings declared in wrangler.toml
	 */
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	/**
	 * The Durable Object exposes an RPC method sayHello which will be invoked when when a Durable
	 *  Object instance receives a request from a Worker via the same method invocation on the stub
	 *
	 * @param name - The name provided to a Durable Object instance from a Worker
	 * @returns The greeting to be sent back to the Worker
	 */
	async sayHello(name: string): Promise<string> {
		return `Hello, ${name}!`;
	}

	async sayHello2(name: string): Promise<string> {
		return `Hello, ${name}!`;
	}

	async fetch(request: Request): Promise<Response> {
		const match = pattern.exec(request.url);
		if (match) {
			const { action } = match.pathname.groups;

			if (action === 'sock') {
				// Creates two ends of a WebSocket connection.
				const webSocketPair = new WebSocketPair();
				const [client, server] = Object.values(webSocketPair);

				this.ctx.acceptWebSocket(server);

				await this.notifyPresence();

				return new Response(null, {
					status: 101,
					webSocket: client,
				});
			}

			if (action === 'image') {
				return new Response('Image Upload', {
					status: 200,
				});
			}
		}

		return new Response('Action not supported', {
			status: 500,
		});
	}

	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		console.log('message', message);
		if (typeof message === 'string') {
			try {
				const j = JSON.parse(message);
				if (j.type === 'broadcast') {
					for (const sock of this.ctx.getWebSockets()) {
						if (sock.readyState === WebSocket.OPEN) {
							sock.send(message);
						}
					}
				}
			} catch (e) {
				console.error(e);
			}
		}
		// ws.send(`[Durable Object] message: ${message}, connections: ${this.ctx.getWebSockets().length}`);
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
		ws.close(code, 'Durable Object is closing WebSocket');

		await this.notifyPresence();
	}

	async notifyPresence() {
		const active = this.ctx.getWebSockets().filter((s) => s.readyState === WebSocket.OPEN);

		const message = JSON.stringify({
			type: 'presence',
			payload: {
				count: active.length,
			},
		});

		for (const sock of active) {
			sock.send(message);
		}
	}
}

export default {
	/**
	 * This is the standard fetch handler for a Cloudflare Worker
	 *
	 * @param request - The request submitted to the Worker from the client
	 * @param env - The interface to reference bindings declared in wrangler.toml
	 * @param ctx - The execution context of the Worker
	 * @returns The response to be sent back to the client
	 */
	async fetch(request, env, ctx): Promise<Response> {
		const match = pattern.exec(request.url);
		if (match) {
			const { uuid, action } = match.pathname.groups;

			let id = env.MY_DURABLE_OBJECT.idFromName(uuid);
			let stub = env.MY_DURABLE_OBJECT.get(id);

			if (action === 'sock') {
				const upgradeHeader = request.headers.get('Upgrade');
				if (!upgradeHeader || upgradeHeader !== 'websocket') {
					return new Response('Durable Object expected Upgrade: websocket', { status: 426 });
				}

				return stub.fetch(request);
			}

			if (action === 'image') {
				// Handle the image upload first
				const uploadResponse = await handleImageUpload(request);
				if (!uploadResponse.ok) {
					return new Response('Image upload failed', { status: 500 });
				}

				// Notify the Durable Object after the upload
				const notifyResponse = await stub.fetch(new Request(request.url, { method: 'POST' }));
				if (!notifyResponse.ok) {
					return new Response('Failed to notify Durable Object', { status: 500 });
				}

				return new Response('Image uploaded and Durable Object notified', { status: 200 });
			}
		}

		// We will create a `DurableObjectId` using the pathname from the Worker request
		// This id refers to a unique instance of our 'MyDurableObject' class above
		let id: DurableObjectId = env.MY_DURABLE_OBJECT.idFromName(new URL(request.url).pathname);

		// This stub creates a communication channel with the Durable Object instance
		// The Durable Object constructor will be invoked upon the first call for a given id
		let stub = env.MY_DURABLE_OBJECT.get(id);

		// We call the `sayHello()` RPC method on the stub to invoke the method on the remote
		// Durable Object instance
		let greeting = await stub.sayHello('world');

		return new Response(greeting);
	},
} satisfies ExportedHandler<Env>;

async function handleImageUpload(request: Request): Promise<Response> {
	// Implement your image upload logic here
	// For example, you can upload to a storage service like Cloudflare R2 or another service
	return new Response('Image uploaded', { status: 200 });
}
