// Правила «Акопчила 108» (вариант Mau Mau / Crazy Eights):
// - Кладём карту той же масти, того же достоинства, либо любую даму (Q) — она "дикая" и меняет масть.
// - 7   -> следующий игрок берёт 2 карты, если нечем ответить своей 6-кой/7-кой.
// - 6   -> следующий игрок берёт 1 карту, если нечем ответить своей 6-кой/7-кой/королём пик.
// - Король пик (K♠) -> следующий игрок берёт 5 карт.
// - 10  -> обычная карта, без спецэффекта.
// - Туз (A) -> следующий игрок пропускает ход.
// - Если нечем ходить — берём карту из колоды, пока не найдётся подходящая (либо пока колода не закончится).
// Особые очки за даму — считаются отдельно в engine.js (бонус победителю раунда, штраф за одинокую даму на руке).

export function canPlay(card, topCard, activeSuit) {
  if (card.rank === 'Q') return true; // дама ходит всегда
  if (topCard.rank === 'Q') return card.suit === activeSuit;
  return card.suit === topCard.suit || card.rank === topCard.rank;
}

export function isSeven(card) {
  return card.rank === '7';
}

export function drawPenaltyFor(card) {
  if (card.rank === '7') return 2;
  if (card.rank === '6') return 1;
  if (card.rank === 'K' && card.suit === '♠') return 5;
  return 0;
}

export function isSkip(card) {
  return card.rank === 'A';
}

export function legalMoves(hand, topCard, activeSuit) {
  return hand.filter((c) => canPlay(c, topCard, activeSuit));
}
