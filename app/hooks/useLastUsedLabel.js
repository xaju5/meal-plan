import { useTranslation } from 'react-i18next';

export function useLastUsedLabel() {
  const { t } = useTranslation();

  function getWeeksAgoLabel(weeksAgo) {
    if (weeksAgo === null) return { text: t('neverUsed'), color: '#bbb' };
    if (weeksAgo === 0) return { text: t('thisWeek'), color: '#4CAF50' };
    if (weeksAgo === 1) return { text: t('oneWeekAgo'), color: '#8bc34a' };
    if (weeksAgo <= 4) return { text: t('weeksAgo', { count: weeksAgo }), color: '#ff9800' };
    return { text: t('overAMonth'), color: '#e53935' };
  }

  return { getWeeksAgoLabel };
}

export function computeWeeksAgo(lastUsedWeek, currentYear, currentWeek) {
  if (!lastUsedWeek) return null;
  return (currentYear - lastUsedWeek.year) * 52 +
    (currentWeek - lastUsedWeek.week_number);
}