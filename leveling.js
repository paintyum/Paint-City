// Leveling and points system
// Every 50 messages = 25 points
// Every 100 messages = level up

export const MESSAGES_PER_LEVEL = 100;
export const POINTS_PER_50_MESSAGES = 25;

// Calculate level from message count
// Level 1: 0-99 messages, Level 2: 100-199, Level 3: 200-299, etc.
export function getLevelFromMessages(messageCount) {
  if (messageCount < 0) return 1;
  return Math.floor(messageCount / MESSAGES_PER_LEVEL) + 1;
}

// Calculate points from message count (25 points every 50 messages)
export function getPointsFromMessages(messageCount) {
  return Math.floor(messageCount / 50) * POINTS_PER_50_MESSAGES;
}

// Get messages needed for next level
export function getMessagesNeededForNextLevel(currentMessageCount) {
  const currentLevel = getLevelFromMessages(currentMessageCount);
  const messagesForNextLevel = currentLevel * MESSAGES_PER_LEVEL;
  return Math.max(0, messagesForNextLevel - currentMessageCount);
}
