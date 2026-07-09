export default function Card({ card, onClick, disabled, small, faceDown }) {
  if (faceDown) {
    return <div className={`card card-back ${small ? 'card-sm' : ''}`} />;
  }
  const red = card.suit === '♥' || card.suit === '♦';
  return (
    <button
      className={`card ${red ? 'card-red' : 'card-black'} ${small ? 'card-sm' : ''} ${disabled ? 'card-disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <span className="card-rank">{card.rank}</span>
      <span className="card-suit">{card.suit}</span>
    </button>
  );
}
