export const getIncrement = (amount: number) => {
  if (amount < 10) return 1;
  if (amount < 50) return 2;
  if (amount < 200) return 5;
  if (amount < 500) return 10;
  return 20;
};

export const formatSeconds = (totalSeconds: number) => {
  if (totalSeconds <= 0) return "00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
