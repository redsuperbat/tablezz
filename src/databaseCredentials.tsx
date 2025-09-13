export const databaseCredentials = {
	key: "url",
	get() {
		return localStorage.getItem(this.key);
	},
	getOrThrow() {
		const url = this.get();
		if (!url) {
			throw new Error("No creds");
		}
		return url;
	},
	set(url: string) {
		return localStorage.setItem(this.key, url);
	},
};
