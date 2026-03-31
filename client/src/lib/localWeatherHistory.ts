export type WeatherResult = {
  location?: string;
  temp?: number;
  feelsLike?: number;
  condition?: string;
  icon?: string;
  [key: string]: unknown;
};

export type StoredWeatherHistoryItem = {
  id: string;
  requestedAt: string;
  result: WeatherResult;
};

const STORAGE_KEY = "weather-app.history";
const MAX_ITEMS = 100;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readWeatherHistory(): StoredWeatherHistoryItem[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is StoredWeatherHistoryItem => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.requestedAt === "string" &&
        typeof item.result === "object" &&
        item.result !== null
      );
    });
  } catch {
    return [];
  }
}

function writeWeatherHistory(items: StoredWeatherHistoryItem[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function appendWeatherHistory(result: WeatherResult) {
  const nextItem: StoredWeatherHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    requestedAt: new Date().toISOString(),
    result,
  };

  const nextItems = [nextItem, ...readWeatherHistory()].slice(0, MAX_ITEMS);
  writeWeatherHistory(nextItems);
  return nextItem;
}

export function removeWeatherHistoryItem(id: string) {
  const nextItems = readWeatherHistory().filter((item) => item.id !== id);
  writeWeatherHistory(nextItems);
}

export function clearWeatherHistory() {
  writeWeatherHistory([]);
}
