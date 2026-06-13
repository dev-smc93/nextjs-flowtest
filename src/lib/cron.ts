import cronstrue from "cronstrue/i18n";
import { CronExpressionParser } from "cron-parser";

export function cronReadable(expr: string): string {
  try {
    return cronstrue.toString(expr, { locale: "ko", use24HourTimeFormat: true });
  } catch {
    return "유효하지 않은 cron 식";
  }
}

export function cronNext(expr: string): Date | null {
  try {
    return CronExpressionParser.parse(expr).next().toDate();
  } catch {
    return null;
  }
}

export function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}
