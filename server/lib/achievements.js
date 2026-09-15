// Achievement definitions. Evaluated on the fly from a stats snapshot (nothing stored).
// Tiers: 1 Bronze, 2 Silver, 3 Gold, 4 Platinum, 5 Diamond. Ratings are on a 10-point scale.
const A = (id, name, description, icon, tier, condition) => ({ id, name, description, icon, tier, condition });
const hours = (s) => s.totalMinutes / 60;

export const ALL_ACHIEVEMENTS = [
  A('movie_1', 'Movie Goer', 'Complete 10 movies.', 'Popcorn', 1, (s) => s.completedMovies >= 10),
  A('movie_2', 'Movie Buff', 'Complete 50 movies.', 'Film', 2, (s) => s.completedMovies >= 50),
  A('movie_3', 'Cinephile', 'Complete 150 movies.', 'Camera', 3, (s) => s.completedMovies >= 150),
  A('movie_4', 'Cinema Deity', 'Complete 300 movies.', 'Clapperboard', 4, (s) => s.completedMovies >= 300),
  A('movie_5', 'Hollywood Legend', 'Complete 500 movies.', 'Star', 5, (s) => s.completedMovies >= 500),
  A('movie_6', 'Film Archivist', 'Complete 1000 movies.', 'Crown', 5, (s) => s.completedMovies >= 1000),

  A('tv_1', 'Episode Explorer', 'Complete 10 TV series.', 'Tv', 1, (s) => s.completedTv >= 10),
  A('tv_2', 'Series Specialist', 'Complete 50 TV series.', 'MonitorPlay', 2, (s) => s.completedTv >= 50),
  A('tv_3', 'Binge Master', 'Complete 150 TV series.', 'Zap', 3, (s) => s.completedTv >= 150),
  A('tv_4', 'Showrunner', 'Complete 250 TV series.', 'Gamepad2', 4, (s) => s.completedTv >= 250),
  A('tv_5', 'TV Titan', 'Complete 500 TV series.', 'Trophy', 5, (s) => s.completedTv >= 500),
  A('tv_6', 'The Omniwatcher', 'Complete 1000 TV series.', 'Gem', 5, (s) => s.completedTv >= 1000),

  A('time_1', 'First Steps', 'Watch for over 24 hours.', 'Play', 1, (s) => hours(s) >= 24),
  A('time_2', 'Couch Commander', 'Watch for over 100 hours.', 'Clock', 2, (s) => hours(s) >= 100),
  A('time_3', 'Marathon Runner', 'Watch for over 500 hours.', 'Timer', 3, (s) => hours(s) >= 500),
  A('time_4', 'Time Wizard', 'Watch for over 1500 hours.', 'Hourglass', 4, (s) => hours(s) >= 1500),
  A('time_5', 'Temporal Master', 'Watch for over 3000 hours.', 'Infinity', 5, (s) => hours(s) >= 3000),
  A('time_6', 'Eternity Watcher', 'Watch for over 5000 hours.', 'Sparkles', 5, (s) => hours(s) >= 5000),

  A('rating_1', 'The Critic', 'Rate 25 titles.', 'MessageSquare', 1, (s) => s.ratedCount >= 25),
  A('rating_2', 'Tastemaker', 'Rate 100 titles.', 'ThumbsUp', 2, (s) => s.ratedCount >= 100),
  A('rating_3', 'Opinion Leader', 'Rate 250 titles.', 'Megaphone', 3, (s) => s.ratedCount >= 250),
  A('rating_4', 'Master Reviewer', 'Rate 500 titles.', 'Award', 4, (s) => s.ratedCount >= 500),

  A('genre_anime', 'Anime Adept', 'Complete 15 Animation titles.', 'Wind', 2, (s) => (s.genreCounts.Animation || 0) >= 15),
  A('genre_anime_master', 'Anime Master', 'Complete 50 Animation titles.', 'Sword', 3, (s) => (s.genreCounts.Animation || 0) >= 50),
  A('genre_scifi', 'Space Explorer', 'Complete 15 Sci-Fi titles.', 'Rocket', 2, (s) => (s.genreCounts['Science Fiction'] || 0) >= 15),
  A('genre_scifi_master', 'Galactic Voyager', 'Complete 50 Sci-Fi titles.', 'Satellite', 3, (s) => (s.genreCounts['Science Fiction'] || 0) >= 50),
  A('genre_comedy', 'Jester', 'Complete 15 Comedy titles.', 'Laugh', 2, (s) => (s.genreCounts.Comedy || 0) >= 15),
  A('genre_comedy_master', 'Comedy King', 'Complete 50 Comedy titles.', 'PartyPopper', 3, (s) => (s.genreCounts.Comedy || 0) >= 50),
  A('genre_drama', 'Drama Enthusiast', 'Complete 15 Drama titles.', 'Theater', 2, (s) => (s.genreCounts.Drama || 0) >= 15),
  A('genre_drama_master', 'Drama Virtuoso', 'Complete 50 Drama titles.', 'Drama', 3, (s) => (s.genreCounts.Drama || 0) >= 50),
  A('genre_horror', 'Fear Seeker', 'Complete 15 Horror titles.', 'Ghost', 2, (s) => (s.genreCounts.Horror || 0) >= 15),
  A('genre_horror_master', 'Nightmare Walker', 'Complete 50 Horror titles.', 'Skull', 3, (s) => (s.genreCounts.Horror || 0) >= 50),
  A('genre_action', 'Action Hero', 'Complete 15 Action titles.', 'Target', 2, (s) => (s.genreCounts.Action || 0) >= 15),
  A('genre_action_master', 'Adrenaline Junkie', 'Complete 50 Action titles.', 'Crosshair', 3, (s) => (s.genreCounts.Action || 0) >= 50),

  A('speed_week', 'Speed Demon', 'Complete 5 titles in one week.', 'Gauge', 2, (s) => s.weeklyCompletions >= 5),
  A('speed_month', 'Productivity Pro', 'Complete 20 titles in one month.', 'TrendingUp', 3, (s) => s.monthlyCompletions >= 20),

  A('perfectionist', 'Perfectionist', 'Give 10 titles a perfect score.', 'Stars', 3, (s) => s.perfectRatings >= 10),
  A('harsh_critic', 'Harsh Critic', 'Give 10 titles one star or less.', 'Frown', 2, (s) => s.worstRatings >= 10),
  A('balanced_viewer', 'Balanced Viewer', 'Complete about as many movies as series (25+ each).', 'Scale', 3,
    (s) => Math.abs(s.completedMovies - s.completedTv) <= 5 && s.completedMovies >= 25),

  A('social_watcher', 'Social Butterfly', 'Have 10 friends on WatchRadar.', 'Users', 2, (s) => s.friendsCount >= 10),
  A('popular_user', 'Popular User', 'Have 25 friends on WatchRadar.', 'Heart', 3, (s) => s.friendsCount >= 25),

  A('weekend_warrior', 'Weekend Warrior', 'Complete 10 titles on weekends.', 'Coffee', 2, (s) => s.weekendCompletions >= 10),
  A('classic_collector', 'Classic Collector', 'Complete 10 titles from before 1990.', 'Archive', 3, (s) => s.classicCompletions >= 10),
  A('decade_explorer', 'Decade Explorer', 'Complete titles from 5 different decades.', 'Calendar', 3, (s) => s.uniqueDecades >= 5),

  A('collector', 'The Collector', 'Have 100 titles on your watchlist.', 'Bookmark', 2, (s) => s.watchlistCount >= 100),
  A('completionist', 'Completionist', 'Complete 90% of everything you ever planned (20+ titles).', 'CheckSquare', 4,
    (s) => s.watchlistCompletionRate >= 0.9 && s.watchlistCount + s.completedTotal >= 20),

  A('rewatcher', 'Second Helping', 'Rewatch 5 titles.', 'Repeat', 2, (s) => s.rewatchedTitles >= 5),
  A('rewatch_master', 'Comfort Viewer', 'Rewatch 25 titles.', 'RefreshCw', 4, (s) => s.rewatchedTitles >= 25),

  A('variety_lover', 'Variety Lover', 'Complete titles from 15 different genres.', 'Shuffle', 4, (s) => s.uniqueGenres >= 15),
  A('genre_master', 'Genre Master', 'Complete titles from 25 different genres.', 'Gem', 5, (s) => s.uniqueGenres >= 25),

  A('century_club', 'Century Club', 'Complete 100 titles.', 'Milestone', 2, (s) => s.completedTotal >= 100),
  A('five_hundred_club', '500 Club', 'Complete 500 titles.', 'Medal', 4, (s) => s.completedTotal >= 500),
  A('thousand_legend', 'Thousand Legend', 'Complete 1000 titles.', 'Crown', 5, (s) => s.completedTotal >= 1000),
];

export function calculateAchievements(stats) {
  const earned = [];
  for (const a of ALL_ACHIEVEMENTS) {
    try {
      if (a.condition(stats)) earned.push({ id: a.id, name: a.name, description: a.description, icon: a.icon, tier: a.tier });
    } catch {
      /* incomplete stats → skip */
    }
  }
  return earned;
}

export const achievementCatalog = () =>
  ALL_ACHIEVEMENTS.map(({ id, name, description, icon, tier }) => ({ id, name, description, icon, tier }));
