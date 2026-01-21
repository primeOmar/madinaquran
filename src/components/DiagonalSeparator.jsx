export default function DiagonalSeparator() {
  return (
    <div className="relative w-full overflow-hidden leading-[0]">
      <svg
        className="relative block w-full h-20"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1200 120"
      >
        <path
          d="M0,0V120H1200V0L600,120Z"
          fill="currentColor"
          className="text-green-900"
        />
      </svg>
    </div>
  );
}
