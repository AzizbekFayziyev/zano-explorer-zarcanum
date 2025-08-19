import axios from "axios";
import ZanoPrice from "../schemes/ZanoPrice";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const BASE_URL = `https://api.mexc.com/api/v3/klines?symbol=ZANOUSDT&interval=1m&limit=1`;
const HISTORY_LIMIT_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

async function fetchPriceForTimestamp(timestamp: number) {

	const url = `${BASE_URL}&startTime=${timestamp - 60 *1000}&endTime=${timestamp}`;
	const res = await axios.get(url);
	if (!Array.isArray(res.data) || res.data.length === 0) return null;

	return {
		timestamp: timestamp,
		price: String(res.data[0][4]),
		raw: res.data[0],
	};
}

export async function syncHistoricalPrice() {
	const oldestPrice = await ZanoPrice.findOne({
		order: [["timestamp", "ASC"]],
		raw: true,
	});


	if (!oldestPrice) {
		throw new Error("Sync latest price before historical");
	}

	if (parseInt(oldestPrice.timestamp, 10) < (+new Date() - HISTORY_LIMIT_MS)) {
		return console.log(`[zano price] Historical Price already synced`);
	}

	const timestampsToSync: number[] = [];

	let oldestTimestamp = parseInt(oldestPrice.timestamp, 10);

	while (oldestTimestamp > (+new Date() - HISTORY_LIMIT_MS)) {
		oldestTimestamp -= FOUR_HOURS_MS;
		timestampsToSync.push(oldestTimestamp);
	}


	for (const element of timestampsToSync) {
		try {
			const price = await fetchPriceForTimestamp(element);
			if (price) {
				await ZanoPrice.create(price);
			}
		} catch (error) {
			console.log(error);
			
		}

		await new Promise(resolve => setTimeout(resolve, 2000));
	}

}

export async function syncLatestPrice() {
	const lastRow = await ZanoPrice.findOne({
		attributes: ["timestamp"],
		order: [["timestamp", "DESC"]],
		raw: true,
	});

	if (lastRow?.timestamp && parseInt(lastRow.timestamp, 10) > (+new Date() - FOUR_HOURS_MS)) {
		return console.log(
			`[zano price] Nothing to sync since ${new Date(parseInt(lastRow.timestamp, 10)).toUTCString()} (UTC)`
		);
	}
	const latestPrice = await fetchPriceForTimestamp(+new Date());

	if (!latestPrice) {
		return console.log(`Unable to fetch latest price from mexc`);
	}

	await ZanoPrice.create(latestPrice);
}