import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** A `<button>` that defaults to `type="button"`; states come from `styles.css`, colours from `BUTTON_TONE`. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} {...props} />;
});
