// Only the icons achievements reference, so the whole lucide set is not bundled.
import {
  Popcorn, Film, Camera, Clapperboard, Star, Crown, Tv, MonitorPlay, Zap, Gamepad2, Trophy, Gem, Play, Clock, Timer, Hourglass,
  Infinity as InfinityIcon, Sparkles, MessageSquare, ThumbsUp, Megaphone, Award, Wind, Sword, Rocket, Satellite, Laugh, PartyPopper, Theater,
  Drama, Ghost, Skull, Target, Crosshair, Gauge, TrendingUp, Frown, Scale, Users, Heart, Coffee, Archive, Calendar, Bookmark,
  CheckSquare, Repeat, RefreshCw, Shuffle, Milestone, Medal,
} from '@lucide/svelte';

export const ACHIEVEMENT_ICONS: Record<string, any> = {
  Popcorn, Film, Camera, Clapperboard, Star, Crown, Tv, MonitorPlay, Zap, Gamepad2, Trophy, Gem, Play, Clock, Timer, Hourglass,
  Infinity: InfinityIcon, Sparkles, MessageSquare, ThumbsUp, Megaphone, Award, Wind, Sword, Rocket, Satellite, Laugh, PartyPopper, Theater,
  Drama, Ghost, Skull, Target, Crosshair, Gauge, TrendingUp, Stars: Sparkles, Frown, Scale, Users, Heart, Coffee, Archive, Calendar, Bookmark,
  CheckSquare, Repeat, RefreshCw, Shuffle, Milestone, Medal,
};
