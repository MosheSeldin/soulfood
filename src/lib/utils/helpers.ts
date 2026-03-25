export function generateId(): string {
	return crypto.randomUUID();
}

/** Parse ISO 8601 duration like "PT30M" or "PT1H30M" into minutes */
export function parseIsoDuration(duration: string | undefined | null): number | null {
	if (!duration) return null;
	const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
	if (!match) return null;
	const hours = parseInt(match[1] || '0', 10);
	const minutes = parseInt(match[2] || '0', 10);
	const seconds = parseInt(match[3] || '0', 10);
	return hours * 60 + minutes + Math.ceil(seconds / 60);
}

/** Parse a serving string like "4 servings" or "4" into a number */
export function parseServings(value: string | string[] | number | undefined | null): number | null {
	if (value == null) return null;
	if (typeof value === 'number') return value;
	const str = Array.isArray(value) ? value[0] : value;
	const match = str?.match(/(\d+)/);
	return match ? parseInt(match[1], 10) : null;
}

/** Format minutes as readable time (e.g., "1:30 שעות" or "45 דקות") */
export function formatTime(minutes: number | null): string {
	if (!minutes) return '';
	if (minutes < 60) return `${minutes} דקות`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (m === 0) return `${h} ${h === 1 ? 'שעה' : 'שעות'}`;
	return `${h}:${m.toString().padStart(2, '0')} שעות`;
}
