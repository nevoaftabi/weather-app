export function getWeatherIcon(iconCode?: string, condition?: string): string {
  if (iconCode?.startsWith("01")) return iconCode.endsWith("n") ? "\u{1F319}" : "\u2600\uFE0F";
  if (iconCode?.startsWith("02")) return iconCode.endsWith("n") ? "\u2601\uFE0F" : "\u{1F324}\uFE0F";
  if (iconCode?.startsWith("03") || iconCode?.startsWith("04")) return "\u2601\uFE0F";
  if (iconCode?.startsWith("09") || iconCode?.startsWith("10")) return "\u{1F327}\uFE0F";
  if (iconCode?.startsWith("11")) return "\u26C8\uFE0F";
  if (iconCode?.startsWith("13")) return "\u2744\uFE0F";
  if (iconCode?.startsWith("50")) return "\u{1F32B}\uFE0F";

  const normalized = (condition ?? "").toLowerCase();
  if (normalized.includes("sun") || normalized.includes("clear")) return "\u2600\uFE0F";
  if (normalized.includes("cloud")) return "\u2601\uFE0F";
  if (normalized.includes("rain") || normalized.includes("drizzle")) return "\u{1F327}\uFE0F";
  if (normalized.includes("storm") || normalized.includes("thunder")) return "\u26C8\uFE0F";
  if (normalized.includes("snow")) return "\u2744\uFE0F";
  if (normalized.includes("fog") || normalized.includes("mist") || normalized.includes("haze")) return "\u{1F32B}\uFE0F";
  return "\u{1F321}\uFE0F";
}
