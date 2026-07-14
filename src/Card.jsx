// Простые оригинальные иллюстрации для королевских карт (валет/дама/король) —
// геометрический минималистичный стиль, никаких заимствованных изображений.
import { getCardBack } from './prefs';

function FaceIllustration({ rank, color }) {
  const stroke = color;
  const fillLight = color === '#c0272d' ? '#f3d3d3' : '#d9d9d9';

  if (rank === 'K') {
    return (
      <svg viewBox="0 0 60 70" width="70%" height="70%">
        {/* корона */}
        <path d="M14 24 L18 10 L26 20 L30 8 L34 20 L42 10 L46 24 Z" fill={stroke} />
        <circle cx="30" cy="8" r="2.4" fill={stroke} />
        <circle cx="18" cy="10" r="2" fill={stroke} />
        <circle cx="42" cy="10" r="2" fill={stroke} />
        {/* лицо */}
        <circle cx="30" cy="34" r="11" fill={fillLight} stroke={stroke} strokeWidth="1.5" />
        {/* борода */}
        <path d="M20 38 Q30 52 40 38 L38 44 Q30 50 22 44 Z" fill={stroke} />
        {/* плечи/воротник */}
        <path d="M10 66 Q30 48 50 66 Z" fill={stroke} />
        <path d="M22 60 L30 66 L38 60 L30 54 Z" fill={fillLight} stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }

  if (rank === 'Q') {
    return (
      <svg viewBox="0 0 60 70" width="70%" height="70%">
        {/* корона */}
        <path d="M17 22 L21 11 L26 19 L30 9 L34 19 L39 11 L43 22 Z" fill={stroke} />
        <circle cx="30" cy="9" r="2.2" fill={stroke} />
        {/* волосы по бокам */}
        <path d="M14 30 Q10 44 16 54 L21 46 Q16 38 18 28 Z" fill={stroke} />
        <path d="M46 30 Q50 44 44 54 L39 46 Q44 38 42 28 Z" fill={stroke} />
        {/* лицо */}
        <circle cx="30" cy="35" r="11" fill={fillLight} stroke={stroke} strokeWidth="1.5" />
        {/* плечи/воротник */}
        <path d="M10 66 Q30 46 50 66 Z" fill={stroke} />
        <path d="M23 58 L30 66 L37 58 L30 52 Z" fill={fillLight} stroke={stroke} strokeWidth="1" />
        {/* цветок в руке — маленький штрих индивидуальности */}
        <circle cx="46" cy="60" r="2.6" fill={fillLight} stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }

  // Валет
  return (
    <svg viewBox="0 0 60 70" width="70%" height="70%">
      {/* берет */}
      <path d="M16 22 Q30 6 44 22 Q34 18 30 20 Q26 18 16 22 Z" fill={stroke} />
      <path d="M40 14 L48 8 L46 16 Z" fill={stroke} />
      {/* лицо */}
      <circle cx="30" cy="34" r="11" fill={fillLight} stroke={stroke} strokeWidth="1.5" />
      {/* плечи/воротник */}
      <path d="M10 66 Q30 48 50 66 Z" fill={stroke} />
      <path d="M22 59 L30 66 L38 59 L30 53 Z" fill={fillLight} stroke={stroke} strokeWidth="1" />
      {/* алебарда — узнаваемая деталь валета */}
      <line x1="50" y1="20" x2="50" y2="66" stroke={stroke} strokeWidth="2" />
      <path d="M44 18 L56 18 L50 8 Z" fill={stroke} />
    </svg>
  );
}

export default function Card({ card, onClick, disabled, small, large, faceDown, badge }) {
  if (faceDown) {
    return (
      <div className={`card card-back cb-${getCardBack()} ${small ? 'card-sm' : ''} ${large ? 'card-lg' : ''}`}>
        <div className="card-back-emblem">108</div>
        {typeof badge === 'number' && <span className="card-stack-badge">{badge}</span>}
      </div>
    );
  }
  const red = card.suit === '♥' || card.suit === '♦';
  const isFace = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  return (
    <button
      className={`card ${red ? 'card-red' : 'card-black'} ${small ? 'card-sm' : ''} ${large ? 'card-lg' : ''} ${disabled ? 'card-disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <span className="card-corner card-corner-top">
        <span className="corner-rank">{card.rank}</span>
        <span className="corner-suit">{card.suit}</span>
      </span>
      {isFace ? (
        <span className="card-face-illustration">
          <FaceIllustration rank={card.rank} color={red ? '#c0272d' : '#1a1a1a'} />
          <span className="card-face-suit">{card.suit}</span>
        </span>
      ) : (
        <span className="card-center-suit">{card.suit}</span>
      )}
      <span className="card-corner card-corner-bottom">
        <span className="corner-rank">{card.rank}</span>
        <span className="corner-suit">{card.suit}</span>
      </span>
    </button>
  );
}
