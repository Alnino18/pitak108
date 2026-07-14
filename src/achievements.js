// Достижения считаются на лету из статистики профиля (users/{uid}) — не хранятся отдельно.
export const ACHIEVEMENTS = [
  { id: 'first_win', icon: '🥇', titleKey: 'ach_first_win', check: (s) => (s.wins || 0) >= 1 },
  { id: 'wins_5', icon: '🏆', titleKey: 'ach_wins_5', check: (s) => (s.wins || 0) >= 5 },
  { id: 'wins_10', icon: '👑', titleKey: 'ach_wins_10', check: (s) => (s.wins || 0) >= 10 },
  { id: 'wins_25', icon: '💎', titleKey: 'ach_wins_25', check: (s) => (s.wins || 0) >= 25 },
  { id: 'queen_win_1', icon: '💃', titleKey: 'ach_queen_1', check: (s) => (s.queenWins || 0) >= 1 },
  { id: 'queen_win_10', icon: '👸', titleKey: 'ach_queen_10', check: (s) => (s.queenWins || 0) >= 10 },
  { id: 'streak_3', icon: '🔥', titleKey: 'ach_streak_3', check: (s) => (s.maxStreak || 0) >= 3 },
  { id: 'streak_5', icon: '⚡', titleKey: 'ach_streak_5', check: (s) => (s.maxStreak || 0) >= 5 },
  { id: 'games_10', icon: '🎮', titleKey: 'ach_games_10', check: (s) => (s.gamesPlayed || 0) >= 10 },
  { id: 'games_50', icon: '🎲', titleKey: 'ach_games_50', check: (s) => (s.gamesPlayed || 0) >= 50 }
];

export function unlockedAchievements(stats) {
  return ACHIEVEMENTS.filter((a) => a.check(stats || {}));
}
