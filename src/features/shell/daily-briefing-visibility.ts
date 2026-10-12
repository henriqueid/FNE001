export const dailyBriefingStorageKey = (userId: string) => `strato-daily-briefing-hidden-v2-${userId}`;

export const shouldAutoOpenDailyBriefing = (hiddenDate: string | null, referenceDate: string) =>
  hiddenDate !== referenceDate;
