export default function Card({ card, onClick, disabled, small, faceDown }) {
  if (faceDown) {
    return (
      <div className={`card card-back ${small ? 'card-sm' : ''}`}>
        <div className="card-back-emblem">108</div>
      </div>
    );
  }
  const red = card.suit === '♥' || card.suit === '♦';
  return (
    <button
      className={`card ${red ? 'card-red' : 'card-black'} ${small ? 'card-sm' : ''} ${disabled ? 'card-disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <span className="card-corner card-corner-top">
        <span className="corner-rank">{card.rank}</span>
        <span className="corner-suit">{card.suit}</span>
      </span>
      <span className="card-center-suit">{card.suit}</span>
      <span className="card-corner card-corner-bottom">
        <span className="corner-rank">{card.rank}</span>
        <span className="corner-suit">{card.suit}</span>
      </span>
    </button>
  );
}
