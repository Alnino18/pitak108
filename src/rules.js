// Правила «Сто одно» (вариант Mau Mau / Crazy Eights):
// - Кладём карту той же масти, того же достоинства, либо любую даму (Q) — она "дикая" и меняет масть.
// - 7   -> следующий игрок берёт 2 карты (4, если это 7♠) и пропускает ход, если нечем ответить своей 7-кой.
// - 10  -> обычная карта, без спецэффекта, разворота хода нет.
// - 6   -> игрок обязан сходить ещё раз сразу после неё (если есть чем).
// - Если нечем ходить — берём карту из колоды, пока не найдётся подходящая (либо пока колода не закончится).

export function canPlay(card, topCard, activeSuit) {
  if (card.rank === 'Q') return true; // дама ходит всегда
  if (topCard.rank === 'Q') return card.suit === activeSuit;
  return card.suit === topCard.suit || card.rank === topCard.rank;
}

export function isSeven(card) {
  return card.rank === '7';
}

export function drawPenaltyFor(card) {
  if (card.rank !== '7') return 0;
  return card.suit === '♠' ? 4 : 2;
}

export function mustPlayAgain(card) {
  return card.rank === '6';
}

export function legalMoves(hand, topCard, activeSuit) {
  return hand.filter((c) => canPlay(c, topCard, activeSuit));
}
