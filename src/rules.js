// Правила «Акопчила 108» (вариант Mau Mau / Crazy Eights):
// - Кладём карту той же масти, того же достоинства, либо любую даму (Q) — она "дикая" и меняет масть.
// - 8   -> обычная карта: закрывается той же мастью, другой восьмёркой или дамой (без доп. ограничений).
// - 7   -> следующий игрок берёт 2 карты, отбиться можно только другой семёркой.
// - 6   -> следующий игрок берёт 1 карту, отбиться можно только другой шестёркой.
// - Король пик (K♠) -> следующий игрок берёт 5 карт, отбиться можно только другим королём пик.
//   (Разные виды штрафа НЕ смешиваются: на 6 отвечает только 6, на 7 — только 7, на K♠ — только K♠.)
// - 10  -> обычная карта, без спецэффекта.
// - Туз (A) -> следующий игрок пропускает ход.
// - Если нечем ходить — берём ОДНУ карту (не больше одного раза за ход), дальше играем её или пропускаем ход.
// Особые очки за даму — считаются отдельно в engine.js (бонус победителю раунда, штраф за одинокую даму на руке).

export function canPlay(card, topCard, activeSuit) {
  if (card.rank === 'Q') return true; // дама ходит всегда
  if (topCard.rank === 'Q') return card.suit === activeSuit; // после дамы — строго выбранная масть
  return card.suit === topCard.suit || card.rank === topCard.rank;
}

export function isSeven(card) {
  return card.rank === '7';
}

// "Вид" штрафной карты — используется, чтобы отбиться можно было только такой же
export function penaltyKind(card) {
  if (card.rank === '7') return '7';
  if (card.rank === '6') return '6';
  if (card.rank === 'K' && card.suit === '♠') return 'K♠';
  return null;
}

export function drawPenaltyFor(card) {
  const kind = penaltyKind(card);
  if (kind === '7') return 2;
  if (kind === '6') return 1;
  if (kind === 'K♠') return 5;
  return 0;
}

export function matchesPendingKind(card, kind) {
  return penaltyKind(card) === kind;
}

export function isSkip(card) {
  return card.rank === 'A';
}

export function legalMoves(hand, topCard, activeSuit) {
  return hand.filter((c) => canPlay(c, topCard, activeSuit));
}
