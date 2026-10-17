/** A flame, drawn as tongues of different length that flicker on their own: red outside, orange, yellow, a white core. The nozzle is at 0,0 and the fire points down (about 28 units long). */
export function Flame() {
  return (
    <g class="flame">
      <path class="fl-t fl-a" d="M-6 0C-9 7-5 12-3 19-2 12 0 9-2 0Z" fill="#ff4d1a" />
      <path class="fl-t fl-b" d="M6 0C9 7 5 12 3 19 2 12 0 9 2 0Z" fill="#ff4d1a" />
      <path class="fl-t fl-c" d="M-4.500 0C-7 8-2 14 0 28 2 14 7 8 4.500 0Z" fill="#ff7a1a" />
      <path class="fl-t fl-d" d="M-3 0C-4.500 5-1.500 10 0 17 1.500 10 4.500 5 3 0Z" fill="#ffc933" />
      <path class="fl-t fl-e" d="M-1.500 0C-2 3-.5 6 0 9 .5 6 2 3 1.500 0Z" fill="#fff6c4" />
    </g>
  );
}
