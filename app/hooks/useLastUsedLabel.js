export function getWeeksAgoLabel(weeksAgo) {
  if (weeksAgo === null) return { text: 'never used', color: '#bbb' };
  if (weeksAgo === 0) return { text: 'this week', color: '#4CAF50' };
  if (weeksAgo === 1) return { text: '1 week ago', color: '#8bc34a' };
  if (weeksAgo <= 4) return { text: `${weeksAgo} weeks ago`, color: '#ff9800' };
  return { text: 'over a month ago', color: '#e53935' };
}

export function computeWeeksAgo(lastUsedWeek, currentYear, currentWeek) {
  if (!lastUsedWeek) return null;
  return (currentYear - lastUsedWeek.year) * 52 +
    (currentWeek - lastUsedWeek.week_number);
}