// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	function acquireVsCodeApi(): {
		postMessage(message: any): void;
		getState(): any;
		setState(state: any): void;
	};
}

export {};
