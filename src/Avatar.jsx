export default function Avatar({ photoURL, emoji, size = 34, className = '' }) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt=""
        className={`avatar-photo ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return <span className={className}>{emoji || '🂡'}</span>;
}
