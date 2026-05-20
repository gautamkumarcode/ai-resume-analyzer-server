import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;
const host = process.env.REDIS_HOST || "localhost";
const port = parseInt(process.env.REDIS_PORT || "6379");
const password = process.env.REDIS_PASSWORD;

export const redis = createClient({
	url: redisUrl || `redis://${password ? `:${password}@` : ""}${host}:${port}`,
	socket: {
		reconnectStrategy: () => false,
	},
});

redis.on("error", (err) => {
	console.error("[Redis] Connection error:", err);
});

redis.on("connect", () => {
	console.log("[Redis] Connected");
});

redis.on("ready", () => {
	console.log("[Redis] Ready");
});

export const connectRedis = async () => {
	if (!redis.isOpen) {
		await redis.connect();
	}
};

export const disconnectRedis = async () => {
	if (redis.isOpen) {
		await redis.quit();
	}
};

export default redis;
