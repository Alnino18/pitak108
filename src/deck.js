export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Штрафные очки за карту, оставшуюся на руке в конце раунда
export const RANK_VALUE = {
  '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 2, Q: 3, K: 4, A: 11
};

export function cardId(suit, rank) {
  return `${rank}${suit}`;
}

// По умолчанию используем 2 колоды по 36 карт (72 карты) — удобнее для 5-6 игроков.
// Карты с одинаковым id встречаются дважды, поэтому у каждой копии свой уникальный instanceId.
export function buildDeck(numDecks = 2) {
  const deck = [];
  let counter = 0;
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        counter += 1;
        deck.push({ id: `${cardId(suit, rank)}-${counter}`, suit, rank });
      }
    }
  }
  return deck;
}

export function shuffle(cards) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function cardValue(card) {
  return RANK_VALUE[card.rank] || 0;
}

export function handValue(cards) {
  return cards.reduce((sum, c) => sum + cardValue(c), 0);
}
