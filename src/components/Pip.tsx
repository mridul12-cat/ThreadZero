export default function Pip({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pip ${className}`}
      viewBox="0 0 180 150"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M134 109c40 8 38-26 22-24-15 2 5 20-18 20"
        stroke="#9b8cba"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <ellipse cx="91" cy="124" rx="69" ry="8" fill="#e9dff0" />
      <path
        d="M38 105c-2-20 6-43 21-51L57 25c0-5 3-6 7-3l23 17c9-2 20-1 27 3l23-13c4-2 6 0 5 4l-5 30c13 20 17 41 7 51-14 15-92 17-104-1Z"
        fill="#d9cbea"
        stroke="#8f7ca9"
        strokeWidth="2"
      />
      <path d="m64 32 13 11-13 7Z" fill="#f2c4cf" />
      <path d="m134 38-14 8 12 8Z" fill="#f2c4cf" />
      <path
        d="M69 77q6 6 12 0m28 0q6 6 12 0"
        stroke="#51465f"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="m91 84 5 4 5-4" fill="#a16d87" />
      <path
        d="M96 88v4m0 0q-5 5-10 0m10 0q5 5 10 0"
        stroke="#79617f"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="67" cy="87" rx="8" ry="4" fill="#f0bac6" />
      <ellipse cx="122" cy="87" rx="8" ry="4" fill="#f0bac6" />
      <path
        d="m49 83-16-3m17 11-14 3m99-11 16-3m-16 11 14 3"
        stroke="#9a85ab"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M65 111q9-7 16 2m27-1q9-7 16 2"
        stroke="#ad98c0"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M28 125c-31 8-30 21 2 20s35-20 7-18c-25 2-15 17 13 14l105-5"
        stroke="#d9b25f"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
